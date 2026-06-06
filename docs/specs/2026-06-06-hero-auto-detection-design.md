# Hero Auto-Detection Design

**Date:** 2026-06-06  
**Status:** Approved  
**Scope:** Phase 1 — OBS Python script detects active RSL hero on screen and auto-shows the hero card overlay

---

## Problem

Streamer must manually search for a hero by name while playing. Goal: automatically detect which hero is active on screen and show the card without any manual input.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  OBS                                                  │
│                                                       │
│  ┌─────────────────┐   frame every 1.5s              │
│  │  Game Source    │──────────────────┐               │
│  └─────────────────┘                 ▼               │
│                              ┌───────────────────┐   │
│  hero-detector.py ◄──────────│ Detection pipeline │   │
│  (OBS Script)                └───────────────────┘   │
│       │  {type:"hero", id:"abbess"}                   │
│       ▼                                               │
│  ws://localhost:7182                                  │
│       │                                               │
│  ┌────────────────────────────┐                      │
│  │  Browser Source            │                      │
│  │  obs.html / obs.js         │◄─── WebSocket client │
│  │  → showHeroCard(hero, 0)   │                      │
│  └────────────────────────────┘                      │
└──────────────────────────────────────────────────────┘
```

---

## Files

| File | Repo | Description |
|------|------|-------------|
| `tools/hero-detector.py` | 🔒 private | OBS Python script — detection + WS server |
| `tools/extract-models.py` | 🔒 private | Extract hero model screenshots from game assets |
| `tools/download-portraits.py` | 🔒 private | Fallback: scrape portraits from hellhades/ayumilove |
| `data/portraits/{hero_id}.png` | 🔒 private | 2D portrait DB for roster screen detection |
| `data/models/{hero_id}.png` | 🔒 private | 3D model DB for battle detection |
| `obs/obs.js` | 🌐 public | Add WebSocket client (~50 lines) |
| `obs/obs.html` | 🌐 public | Optional: WS status indicator |

---

## Detection Scenarios

### Scenario A — Roster / Collection Screen

Triggered when the streamer opens a hero's detail panel in the game's hero collection.

- **Timer:** every 2s
- **ROI:** right panel portrait area (~60–85% screen width, 10–70% height)
- **Pipeline:**
  1. Crop ROI from game source frame
  2. Convert to grayscale
  3. pHash pre-filter → top-10 candidates from `data/portraits/`
  4. `cv2.matchTemplate` with `TM_CCOEFF_NORMED` on top-10
  5. `max_val > 0.82` → hero confirmed → WS push

### Scenario B — Battle Active Turn

Triggered when a hero's turn starts in battle. RSL shows a glowing circle under the active hero — green for the player's hero, red for the enemy's.

**Step 1: Circle detection (trigger)**
```python
# Green circle: hue 55–75, sat > 150, val > 150
# Red circle:   hue 0–10,  sat > 150, val > 150
```
Full frame HSV color mask. Fast (< 1ms). Returns circle centroid (x, y).

**Step 2: Battle cache lookup**
```
Circle @ (x, y)
    │
    ├─ battle_cache[(x±50, y±50)] hit? → instant hero_id, skip matching
    │
    └─ cache miss → run model matching:
          1. Crop region above centroid (~10% frame width × 32% frame height, centered on x)
          2. pHash pre-filter → top-10 candidates from data/models/
          3. ORB feature matching on top-10
             (robust to animation and partial visual effects)
          4. Best match confidence > 0.65 → hero_id
          5. battle_cache[(x, y)] = hero_id
```

**Battle cache lifecycle:**
- Built incrementally as heroes take turns (first match is full; subsequent are instant lookup)
- Cleared on battle-end detection (round indicator disappears + skill bar absent)
- Manual clear button in OBS Script properties panel

**Why ORB for models, not matchTemplate:**  
Hero 3D models are animated and may be covered by buff/debuff visual effects (glow, particles). ORB feature matching is robust to these changes; pixel-level template matching is not.

---

## WebSocket Protocol

**Server:** runs inside `hero-detector.py` on `ws://localhost:PORT` (default `7182`)  
**Client:** `obs.js` connects on page load, reconnects with exponential backoff (max 30s interval)

```json
// Hero detected (battle turn or roster hover)
{ "type": "hero", "id": "abbess", "team": "player" }

// No hero detected for AUTO_DISMISS_DELAY seconds
{ "type": "hero", "id": null }

// Connection handshake
{ "type": "status", "connected": true }
```

`obs.js` on message:
- `id` present → `findHero(id)` in loaded heroes array → `showHeroCard(hero, 0)`
- `id === null` → dismiss card (only if card was auto-shown, not manually pinned)

---

## OBS Script Properties (UI in OBS → Tools → Scripts)

| Property | Default | Type |
|----------|---------|------|
| Game source name | `"Game Capture"` | text |
| Portraits DB path | `data/portraits/` | path |
| Models DB path | `data/models/` | path |
| WebSocket port | `7182` | int |
| Detection interval | `1.5` s | float |
| Portrait confidence threshold | `0.82` | float |
| Model confidence threshold | `0.65` | float |
| Circle HSV — green range | `55–75 / 150 / 150` | text |
| Circle HSV — red range | `0–10 / 150 / 150` | text |
| Auto-dismiss delay | `5` s | int |
| Clear battle cache | button | button |

---

## Matching Pipeline Detail

```
Input: frame crop (ROI or model region)
       │
       ▼
1. pHash pre-filter                   < 1ms per hero
   ├─ resize to 8×8 grayscale
   ├─ DCT → 64-bit hash
   └─ Hamming distance vs all reference hashes
      → top-10 closest candidates

2. Precise match on top-10           ~5ms total
   ├─ Portrait ROI:   cv2.matchTemplate TM_CCOEFF_NORMED
   └─ Model crop:     ORB keypoint matching
                      → good matches / total keypoints ratio

3. Threshold check
   └─ score > threshold → hero confirmed → WS push
```

---

## Model Reference DB

**Primary source:** Unity asset bundles (RSL PC client)
- Tool: `AssetRipper` or `UnityPy` → extract texture renders per hero
- Stored as `data/models/{hero_id}.png`

**Fallback:** automated in-game roster screenshot
- Script cycles through the hero collection
- OBS captures a screenshot of each hero's 3D model at a fixed viewport
- Same camera angle as battle → consistent matching

---

## obs.js Changes (public repo)

```javascript
// New: WebSocket client for auto-detection
function connectDetector() {
  const ws = new WebSocket(`ws://localhost:${DETECTOR_PORT}`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'hero' && msg.id) {
      const hero = heroes.find(h => h.id === msg.id);
      if (hero) showHeroCard(hero, 0);
      autoShown = true;
    } else if (msg.type === 'hero' && !msg.id && autoShown) {
      dismissCard();
      autoShown = false;
    }
  };
  ws.onclose = () => setTimeout(connectDetector, Math.min(delay *= 2, 30000));
}
```

`autoShown` flag ensures manually pinned cards are not auto-dismissed.

---

## Out of Scope (Phase 2)

- Hero recognition from 3D model without circle trigger (hover on model mid-battle)
- Pre-battle formation screen detection
- Confidence UI shown to streamer
- Multi-monitor support
