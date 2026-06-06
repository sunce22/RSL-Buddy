# Hero Auto-Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OBS Python script that detects the active RSL hero on screen (roster portrait or battle circle) and auto-shows the hero card in the OBS overlay via WebSocket.

**Architecture:** `tools/hero_detector.py` (private repo) contains all detection logic as importable functions, plus OBS bindings guarded by `try: import obspython`. It starts a background asyncio WebSocket server and a 1.5 s detection timer. `obs/obs.js` (public repo) connects to `ws://localhost:7182` and calls `showHeroCard()` / `dismissCard()` on incoming messages.

**Tech Stack:** Python 3.10+ (OBS bundled), `opencv-python`, `Pillow`, `imagehash`, `websockets`, `pytest`, `pytest-asyncio`; JavaScript (obs.js WebSocket client).

---

## File Map

| File | Repo | Action |
|------|------|--------|
| `tools/hero_detector.py` | 🔒 private | CREATE — all detection logic + OBS bindings |
| `tools/download_portraits.py` | 🔒 private | CREATE — batch portrait downloader |
| `tools/extract_models.py` | 🔒 private | CREATE — semi-auto model DB builder |
| `data/portraits/` | 🔒 private | CREATE (dir) — populated by `download_portraits.py` |
| `data/models/` | 🔒 private | CREATE (dir) — populated by `extract_models.py` |
| `tests/conftest.py` | 🔒 private | CREATE — pytest path setup |
| `tests/test_ws_server.py` | 🔒 private | CREATE — WebSocket server tests |
| `tests/test_detection.py` | 🔒 private | CREATE — detection function tests |
| `obs/obs.js` | 🌐 public | MODIFY — add WebSocket client (after line 317) |

---

## Task 1: Python Dependencies

**Files:** no code files — setup only

- [ ] **Step 1: Verify OBS Python path is configured**

  OBS → Tools → Scripts → Python Settings → set path to your system Python 3.10+ install (e.g. `C:\Python311`). Must match the pip you run below.

- [ ] **Step 2: Install required packages**

  ```bash
  pip install opencv-python Pillow imagehash websockets pytest pytest-asyncio
  ```

  Expected: all packages install without error.

- [ ] **Step 3: Verify imports**

  ```bash
  python -c "import cv2, imagehash, websockets; print('OK')"
  ```

  Expected output: `OK`

---

## Task 2: Portrait DB Downloader

**Files:**
- Create: `d:\projects\twitch-extension-private\tools\download_portraits.py`

- [ ] **Step 1: Create the script**

  ```python
  """Download hero portrait images from heroes.json URLs into data/portraits/."""
  import json
  import time
  import urllib.request
  from pathlib import Path

  HEROES_JSON = Path(__file__).parent.parent / "data" / "heroes.json"
  PORTRAITS_DIR = Path(__file__).parent.parent / "data" / "portraits"


  def portrait_url(hero: dict) -> str:
      if hero.get("portrait"):
          return hero["portrait"]
      slug = hero["name"].lower().replace(" ", "-").replace("'", "")
      return f"https://ayumilove.net/files/games/raid-shadow-legends/hero/{slug}.jpg"


  def download_portraits():
      PORTRAITS_DIR.mkdir(parents=True, exist_ok=True)
      heroes = json.loads(HEROES_JSON.read_text(encoding="utf-8"))
      total = len(heroes)
      for i, hero in enumerate(heroes, 1):
          dest = PORTRAITS_DIR / f"{hero['id']}.png"
          if dest.exists():
              print(f"[{i}/{total}] skip  {hero['id']}")
              continue
          url = portrait_url(hero)
          try:
              urllib.request.urlretrieve(url, dest)
              print(f"[{i}/{total}] ok    {hero['id']}")
          except Exception as e:
              print(f"[{i}/{total}] FAIL  {hero['id']}: {e}")
          time.sleep(0.3)


  if __name__ == "__main__":
      download_portraits()
  ```

- [ ] **Step 2: Run the downloader**

  ```bash
  cd d:\projects\twitch-extension-private
  python tools/download_portraits.py
  ```

  Expected: PNG files appear in `data/portraits/`. Some may 404 (fallback URLs will be tried by the detector at runtime).

- [ ] **Step 3: Verify output count**

  ```bash
  python -c "from pathlib import Path; f=list(Path('data/portraits').glob('*.png')); print(f'{len(f)} portraits')"
  ```

  Expected: `250+ portraits`

- [ ] **Step 4: Commit**

  ```bash
  cd d:\projects\twitch-extension-private
  git add tools/download_portraits.py
  git commit -m "feat: add portrait DB downloader"
  ```

---

## Task 3: WebSocket Server + pytest Setup

**Files:**
- Create: `d:\projects\twitch-extension-private\tools\hero_detector.py`
- Create: `d:\projects\twitch-extension-private\tests\conftest.py`
- Create: `d:\projects\twitch-extension-private\tests\test_ws_server.py`

- [ ] **Step 1: Create `tests/conftest.py`**

  ```python
  import sys
  from pathlib import Path
  sys.path.insert(0, str(Path(__file__).parent.parent / "tools"))
  ```

- [ ] **Step 2: Write the failing tests**

  ```python
  # tests/test_ws_server.py
  import asyncio
  import json
  import pytest
  import websockets


  @pytest.mark.asyncio
  async def test_server_broadcasts_hero_message():
      from hero_detector import DetectorServer
      server = DetectorServer(port=17182)
      server.start()
      await asyncio.sleep(0.15)

      received = []
      async with websockets.connect("ws://localhost:17182") as ws:
          server.push({"type": "hero", "id": "abbess"})
          await asyncio.sleep(0.15)
          msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
          received.append(json.loads(msg))

      server.stop()
      assert received == [{"type": "hero", "id": "abbess"}]


  @pytest.mark.asyncio
  async def test_server_broadcasts_to_multiple_clients():
      from hero_detector import DetectorServer
      server = DetectorServer(port=17183)
      server.start()
      await asyncio.sleep(0.15)

      async with websockets.connect("ws://localhost:17183") as ws1, \
                 websockets.connect("ws://localhost:17183") as ws2:
          server.push({"type": "hero", "id": "kael"})
          await asyncio.sleep(0.15)
          msg1 = await asyncio.wait_for(ws1.recv(), timeout=1.0)
          msg2 = await asyncio.wait_for(ws2.recv(), timeout=1.0)

      server.stop()
      assert json.loads(msg1)["id"] == "kael"
      assert json.loads(msg2)["id"] == "kael"
  ```

- [ ] **Step 3: Run to confirm they fail**

  ```bash
  cd d:\projects\twitch-extension-private
  pytest tests/test_ws_server.py -v
  ```

  Expected: `ImportError: cannot import name 'DetectorServer' from 'hero_detector'`

- [ ] **Step 4: Create `tools/hero_detector.py` with `DetectorServer`**

  ```python
  """RSL Hero Auto-Detector — OBS Python script + detection utilities.

  All detection logic is importable without OBS.
  OBS bindings are at the bottom, guarded by try/except ImportError.
  Requires Python 3.10+, opencv-python, Pillow, imagehash, websockets.
  """
  import asyncio
  import json
  import threading
  import websockets


  class DetectorServer:
      """Asyncio WebSocket server running in a background daemon thread."""

      def __init__(self, port: int = 7182):
          self.port = port
          self._clients: set = set()
          self._loop: asyncio.AbstractEventLoop | None = None
          self._thread: threading.Thread | None = None

      def start(self):
          self._loop = asyncio.new_event_loop()
          self._thread = threading.Thread(target=self._run, daemon=True)
          self._thread.start()

      def _run(self):
          asyncio.set_event_loop(self._loop)
          self._loop.run_until_complete(self._serve())

      async def _serve(self):
          async with websockets.serve(self._handler, "localhost", self.port):
              await asyncio.Future()

      async def _handler(self, websocket, path=None):
          self._clients.add(websocket)
          try:
              await websocket.wait_closed()
          finally:
              self._clients.discard(websocket)

      def push(self, msg: dict):
          if not self._loop or not self._clients:
              return
          asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(msg)), self._loop)

      async def _broadcast(self, message: str):
          for ws in list(self._clients):
              try:
                  await ws.send(message)
              except Exception:
                  self._clients.discard(ws)

      def stop(self):
          if self._loop:
              self._loop.call_soon_threadsafe(self._loop.stop)
  ```

- [ ] **Step 5: Run tests to confirm they pass**

  ```bash
  pytest tests/test_ws_server.py -v
  ```

  Expected:
  ```
  PASSED tests/test_ws_server.py::test_server_broadcasts_hero_message
  PASSED tests/test_ws_server.py::test_server_broadcasts_to_multiple_clients
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add tools/hero_detector.py tests/conftest.py tests/test_ws_server.py
  git commit -m "feat: add WebSocket server and pytest setup"
  ```

---

## Task 4: Hero Database Loader

**Files:**
- Modify: `tools/hero_detector.py` — append `HeroDatabase` class
- Create: `tests/test_detection.py`

- [ ] **Step 1: Write the failing tests**

  ```python
  # tests/test_detection.py
  import cv2
  import numpy as np
  import pytest
  from PIL import Image


  def make_portrait(color_bgr: tuple, size=(140, 182)) -> np.ndarray:
      return np.full((*reversed(size), 3), color_bgr, dtype=np.uint8)


  @pytest.fixture
  def portrait_db(tmp_path):
      portraits = tmp_path / "portraits"
      portraits.mkdir()
      for hero_id, color in [("hero_a", (200, 80, 50)), ("hero_b", (50, 200, 80)), ("hero_c", (80, 50, 200))]:
          cv2.imwrite(str(portraits / f"{hero_id}.png"), make_portrait(color))
      return str(portraits)


  @pytest.fixture
  def model_db(tmp_path):
      models = tmp_path / "models"
      models.mkdir()
      for hero_id, color in [("hero_a", (200, 80, 50)), ("hero_b", (50, 200, 80))]:
          cv2.imwrite(str(models / f"{hero_id}.png"), make_portrait(color, size=(200, 350)))
      return str(models)


  def test_database_loads_portraits(portrait_db, model_db):
      from hero_detector import HeroDatabase
      db = HeroDatabase(portrait_db, model_db)
      db.load()
      assert len(db.portraits) == 3
      assert "hero_a" in db.portraits
      assert "phash" in db.portraits["hero_a"]
      assert "img_gray" in db.portraits["hero_a"]


  def test_database_loads_models(portrait_db, model_db):
      from hero_detector import HeroDatabase
      db = HeroDatabase(portrait_db, model_db)
      db.load()
      assert len(db.models) == 2
      assert db.models["hero_a"]["des"] is not None


  def test_top_portrait_candidates_returns_closest(portrait_db, model_db):
      from hero_detector import HeroDatabase
      import imagehash
      db = HeroDatabase(portrait_db, model_db)
      db.load()
      img_a = make_portrait((200, 80, 50))
      query_hash = imagehash.phash(Image.fromarray(cv2.cvtColor(img_a, cv2.COLOR_BGR2RGB)))
      candidates = db.top_portrait_candidates(query_hash, n=2)
      assert candidates[0] == "hero_a"
  ```

- [ ] **Step 2: Run to confirm they fail**

  ```bash
  pytest tests/test_detection.py -v -k "database or candidates"
  ```

  Expected: `ImportError: cannot import name 'HeroDatabase'`

- [ ] **Step 3: Append `HeroDatabase` to `tools/hero_detector.py`**

  Add after the `DetectorServer` class:

  ```python
  import cv2
  import numpy as np
  import imagehash
  from pathlib import Path
  from PIL import Image


  STANDARD_PORTRAIT = (140, 182)   # (width, height) for NCC comparison


  class HeroDatabase:
      """Loads portrait and model images; provides pHash-ranked candidate lists."""

      def __init__(self, portraits_path: str, models_path: str):
          self._portraits_path = Path(portraits_path)
          self._models_path = Path(models_path)
          self.portraits: dict = {}   # hero_id -> {phash, img_gray}
          self.models: dict = {}      # hero_id -> {phash, kp, des}

      def load(self):
          self._load_portraits()
          self._load_models()

      def _load_portraits(self):
          for png in self._portraits_path.glob("*.png"):
              pil = Image.open(png).convert("RGB")
              self.portraits[png.stem] = {
                  "phash": imagehash.phash(pil),
                  "img_gray": cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2GRAY),
              }

      def _load_models(self):
          orb = cv2.ORB_create()
          for png in self._models_path.glob("*.png"):
              pil = Image.open(png).convert("RGB")
              gray = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2GRAY)
              kp, des = orb.detectAndCompute(gray, None)
              self.models[png.stem] = {
                  "phash": imagehash.phash(pil),
                  "kp": kp,
                  "des": des,
              }

      def top_portrait_candidates(self, query_hash, n: int = 10) -> list[str]:
          ranked = sorted(self.portraits.items(), key=lambda x: query_hash - x[1]["phash"])
          return [hid for hid, _ in ranked[:n]]

      def top_model_candidates(self, query_hash, n: int = 10) -> list[str]:
          ranked = sorted(self.models.items(), key=lambda x: query_hash - x[1]["phash"])
          return [hid for hid, _ in ranked[:n]]
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  pytest tests/test_detection.py -v -k "database or candidates"
  ```

  Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/hero_detector.py tests/test_detection.py
  git commit -m "feat: add HeroDatabase loader with pHash indexing"
  ```

---

## Task 5: Screen Capture + Portrait Matching

**Files:**
- Modify: `tools/hero_detector.py` — append `capture_screen`, `match_portrait`, `detect_roster_hero`
- Modify: `tests/test_detection.py` — add 4 new tests

- [ ] **Step 1: Add the failing tests**

  Append to `tests/test_detection.py`:

  ```python
  def test_match_portrait_identical_returns_high_score():
      from hero_detector import match_portrait
      img = make_portrait((200, 80, 50))
      gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
      assert match_portrait(img, gray) > 0.95


  def test_match_portrait_different_returns_low_score():
      from hero_detector import match_portrait
      img = make_portrait((200, 80, 50))
      other = cv2.cvtColor(make_portrait((50, 200, 80)), cv2.COLOR_BGR2GRAY)
      assert match_portrait(img, other) < 0.70


  def test_detect_roster_hero_finds_correct_hero(portrait_db, model_db):
      from hero_detector import HeroDatabase, detect_roster_hero
      db = HeroDatabase(portrait_db, model_db)
      db.load()
      frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
      # Place hero_b portrait inside the roster ROI (60–85% width, 10–70% height)
      x1, y1 = int(1920 * 0.60), int(1080 * 0.10)
      frame[y1:y1+182, x1:x1+140] = make_portrait((50, 200, 80))  # hero_b color
      assert detect_roster_hero(frame, db, threshold=0.90) == "hero_b"


  def test_detect_roster_hero_returns_none_for_empty_frame(portrait_db, model_db):
      from hero_detector import HeroDatabase, detect_roster_hero
      db = HeroDatabase(portrait_db, model_db)
      db.load()
      frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
      assert detect_roster_hero(frame, db, threshold=0.90) is None
  ```

- [ ] **Step 2: Run to confirm they fail**

  ```bash
  pytest tests/test_detection.py -v -k "match_portrait or roster"
  ```

  Expected: `ImportError: cannot import name 'match_portrait'`

- [ ] **Step 3: Append functions to `tools/hero_detector.py`**

  Add after `HeroDatabase`:

  ```python
  from PIL import ImageGrab


  def capture_screen() -> np.ndarray | None:
      """Capture full screen. Returns BGR numpy array or None on failure."""
      try:
          return cv2.cvtColor(np.array(ImageGrab.grab()), cv2.COLOR_RGB2BGR)
      except Exception:
          return None


  def match_portrait(roi_bgr: np.ndarray, template_gray: np.ndarray) -> float:
      """Normalized cross-correlation between roi_bgr and template_gray. Returns 0.0–1.0."""
      roi_gray = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2GRAY)
      roi_r = cv2.resize(roi_gray, STANDARD_PORTRAIT).astype(np.float32) / 255.0
      tmpl_r = cv2.resize(template_gray, STANDARD_PORTRAIT).astype(np.float32) / 255.0
      roi_std, tmpl_std = roi_r.std(), tmpl_r.std()
      if roi_std < 1e-6 or tmpl_std < 1e-6:
          return 0.0
      ncc = float(np.mean((roi_r - roi_r.mean()) * (tmpl_r - tmpl_r.mean())) / (roi_std * tmpl_std))
      return (ncc + 1.0) / 2.0


  def detect_roster_hero(
      frame_bgr: np.ndarray,
      db: HeroDatabase,
      threshold: float = 0.82,
  ) -> str | None:
      """Detect hero portrait in the roster detail panel. Returns hero_id or None."""
      if not db.portraits:
          return None
      h, w = frame_bgr.shape[:2]
      x1, y1 = int(w * 0.60), int(h * 0.10)
      x2, y2 = int(w * 0.85), int(h * 0.70)
      roi = frame_bgr[y1:y2, x1:x2]

      query_hash = imagehash.phash(Image.fromarray(cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)))
      candidates = db.top_portrait_candidates(query_hash, n=10)

      best_id, best_score = None, 0.0
      for hero_id in candidates:
          score = match_portrait(roi, db.portraits[hero_id]["img_gray"])
          if score > best_score:
              best_score, best_id = score, hero_id

      return best_id if best_score >= threshold else None
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  pytest tests/test_detection.py -v -k "match_portrait or roster"
  ```

  Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/hero_detector.py tests/test_detection.py
  git commit -m "feat: add portrait matching and roster ROI detection"
  ```

---

## Task 6: Circle Detection (Battle Turn Trigger)

**Files:**
- Modify: `tools/hero_detector.py` — append `find_active_circle`
- Modify: `tests/test_detection.py` — add 4 new tests

- [ ] **Step 1: Add the failing tests**

  Append to `tests/test_detection.py`:

  ```python
  def make_circle_frame(center: tuple, color_bgr: tuple, radius: int = 45) -> np.ndarray:
      frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
      cv2.circle(frame, center, radius, color_bgr, -1)
      return frame


  def test_finds_green_circle_as_player():
      from hero_detector import find_active_circle
      frame = make_circle_frame((960, 800), (0, 230, 0))
      result = find_active_circle(frame)
      assert result is not None
      cx, cy, team = result
      assert team == "player"
      assert abs(cx - 960) < 60
      assert abs(cy - 800) < 60


  def test_finds_red_circle_as_enemy():
      from hero_detector import find_active_circle
      frame = make_circle_frame((500, 600), (0, 0, 230))
      result = find_active_circle(frame)
      assert result is not None
      assert result[2] == "enemy"


  def test_no_circle_in_black_frame():
      from hero_detector import find_active_circle
      assert find_active_circle(np.zeros((1080, 1920, 3), dtype=np.uint8)) is None


  def test_tiny_green_speck_does_not_trigger():
      from hero_detector import find_active_circle
      frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
      cv2.circle(frame, (100, 100), 5, (0, 230, 0), -1)   # area < min threshold
      assert find_active_circle(frame) is None
  ```

- [ ] **Step 2: Run to confirm they fail**

  ```bash
  pytest tests/test_detection.py -v -k "circle or speck"
  ```

  Expected: `ImportError: cannot import name 'find_active_circle'`

- [ ] **Step 3: Append `find_active_circle` to `tools/hero_detector.py`**

  ```python
  _GREEN_LO = np.array([55, 150, 150], dtype=np.uint8)
  _GREEN_HI = np.array([75, 255, 255], dtype=np.uint8)
  _RED_LO1  = np.array([0,  150, 150], dtype=np.uint8)
  _RED_HI1  = np.array([10, 255, 255], dtype=np.uint8)
  _RED_LO2  = np.array([170, 150, 150], dtype=np.uint8)
  _RED_HI2  = np.array([180, 255, 255], dtype=np.uint8)
  _CIRCLE_MIN_AREA = 500


  def find_active_circle(frame_bgr: np.ndarray) -> tuple[int, int, str] | None:
      """Detect glowing active-turn circle. Returns (cx, cy, 'player'|'enemy') or None."""
      hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
      mask_green = cv2.inRange(hsv, _GREEN_LO, _GREEN_HI)
      mask_red = cv2.bitwise_or(
          cv2.inRange(hsv, _RED_LO1, _RED_HI1),
          cv2.inRange(hsv, _RED_LO2, _RED_HI2),
      )

      def centroid(mask: np.ndarray, team: str) -> tuple[int, int, str] | None:
          contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
          if not contours:
              return None
          largest = max(contours, key=cv2.contourArea)
          if cv2.contourArea(largest) < _CIRCLE_MIN_AREA:
              return None
          M = cv2.moments(largest)
          if M["m00"] == 0:
              return None
          return int(M["m10"] / M["m00"]), int(M["m01"] / M["m00"]), team

      return centroid(mask_green, "player") or centroid(mask_red, "enemy")
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  pytest tests/test_detection.py -v -k "circle or speck"
  ```

  Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/hero_detector.py tests/test_detection.py
  git commit -m "feat: add HSV circle detection for battle turn trigger"
  ```

---

## Task 7: ORB Model Matching + Battle Cache

**Files:**
- Modify: `tools/hero_detector.py` — append `match_model_orb`, `BattleCache`, `detect_battle_hero`
- Modify: `tests/test_detection.py` — add 4 new tests

- [ ] **Step 1: Add the failing tests**

  Append to `tests/test_detection.py`:

  ```python
  def test_match_model_orb_identical_images_high_score():
      from hero_detector import match_model_orb
      img = make_portrait((100, 150, 200), size=(200, 350))
      gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
      orb = cv2.ORB_create()
      kp, des = orb.detectAndCompute(gray, None)
      assert match_model_orb(gray, kp, des, kp, des) > 0.5


  def test_match_model_orb_different_images_low_score():
      from hero_detector import match_model_orb
      orb = cv2.ORB_create()
      gray1 = cv2.cvtColor(make_portrait((100, 150, 200), size=(200, 350)), cv2.COLOR_BGR2GRAY)
      gray2 = cv2.cvtColor(make_portrait((200, 50, 10), size=(200, 350)), cv2.COLOR_BGR2GRAY)
      kp1, des1 = orb.detectAndCompute(gray1, None)
      kp2, des2 = orb.detectAndCompute(gray2, None)
      assert match_model_orb(gray1, kp1, des1, kp2, des2) < 0.3


  def test_battle_cache_stores_and_retrieves():
      from hero_detector import BattleCache
      cache = BattleCache(position_tolerance=50)
      cache.store(500, 700, "abbess")
      assert cache.lookup(510, 690) == "abbess"
      assert cache.lookup(600, 800) is None


  def test_battle_cache_clears():
      from hero_detector import BattleCache
      cache = BattleCache(position_tolerance=50)
      cache.store(500, 700, "abbess")
      cache.clear()
      assert cache.lookup(500, 700) is None
  ```

- [ ] **Step 2: Run to confirm they fail**

  ```bash
  pytest tests/test_detection.py -v -k "orb or battle_cache"
  ```

  Expected: `ImportError: cannot import name 'match_model_orb'`

- [ ] **Step 3: Append to `tools/hero_detector.py`**

  ```python
  def match_model_orb(
      query_gray: np.ndarray,
      query_kp,
      query_des,
      ref_kp,
      ref_des,
      distance_threshold: int = 50,
  ) -> float:
      """ORB feature match ratio. Returns good_matches / total_query_keypoints (0–1)."""
      if query_des is None or ref_des is None or not query_kp:
          return 0.0
      bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
      matches = bf.match(query_des, ref_des)
      good = [m for m in matches if m.distance < distance_threshold]
      return len(good) / max(len(query_kp), 1)


  class BattleCache:
      """Maps screen positions to hero IDs within one battle. Cleared between battles."""

      def __init__(self, position_tolerance: int = 50):
          self._tolerance = position_tolerance
          self._entries: list[tuple[int, int, str]] = []

      def lookup(self, cx: int, cy: int) -> str | None:
          for ex, ey, hero_id in self._entries:
              if abs(cx - ex) <= self._tolerance and abs(cy - ey) <= self._tolerance:
                  return hero_id
          return None

      def store(self, cx: int, cy: int, hero_id: str):
          self._entries.append((cx, cy, hero_id))

      def clear(self):
          self._entries.clear()


  def detect_battle_hero(
      frame_bgr: np.ndarray,
      cx: int,
      cy: int,
      db: HeroDatabase,
      cache: BattleCache,
      threshold: float = 0.65,
  ) -> str | None:
      """Identify hero above circle centroid. Checks cache first, then runs ORB match."""
      cached = cache.lookup(cx, cy)
      if cached:
          return cached

      h, w = frame_bgr.shape[:2]
      crop_w = int(w * 0.10)
      crop_h = int(h * 0.32)
      x1 = max(cx - crop_w // 2, 0)
      y1 = max(cy - crop_h, 0)
      x2 = min(cx + crop_w // 2, w)
      y2 = cy
      crop = frame_bgr[y1:y2, x1:x2]
      if crop.size == 0:
          return None

      crop_gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
      query_hash = imagehash.phash(Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)))
      candidates = db.top_model_candidates(query_hash, n=10)

      orb = cv2.ORB_create()
      query_kp, query_des = orb.detectAndCompute(crop_gray, None)

      best_id, best_score = None, 0.0
      for hero_id in candidates:
          m = db.models[hero_id]
          score = match_model_orb(crop_gray, query_kp, query_des, m["kp"], m["des"])
          if score > best_score:
              best_score, best_id = score, hero_id

      if best_score >= threshold and best_id:
          cache.store(cx, cy, best_id)
          return best_id
      return None
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  pytest tests/test_detection.py -v -k "orb or battle_cache"
  ```

  Expected: 4 tests PASS.

- [ ] **Step 5: Run full suite to confirm nothing broken**

  ```bash
  pytest tests/ -v
  ```

  Expected: all tests PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add tools/hero_detector.py tests/test_detection.py
  git commit -m "feat: add ORB model matching and battle cache"
  ```

---

## Task 8: OBS Script Assembly

**Files:**
- Modify: `tools/hero_detector.py` — append OBS bindings block at end of file

No automated tests — OBS is required. Manual verification steps provided.

- [ ] **Step 1: Append OBS bindings to end of `tools/hero_detector.py`**

  ```python
  # ── OBS Python bindings ────────────────────────────────────────────────────
  # Executed only when loaded inside OBS. All imports and globals are scoped
  # to this try/except block so pytest can import this file without OBS.

  try:
      import obspython as obs

      _server: DetectorServer | None = None
      _db: HeroDatabase | None = None
      _cache: BattleCache = BattleCache()
      _last_hero_id: str | None = None

      _S_PORTRAITS  = "portraits_path"
      _S_MODELS     = "models_path"
      _S_PORT       = "ws_port"
      _S_INTERVAL   = "interval_ms"
      _S_P_THRESH   = "portrait_threshold"
      _S_M_THRESH   = "model_threshold"

      _portraits_path     = ""
      _models_path        = ""
      _ws_port            = 7182
      _interval_ms        = 1500
      _portrait_threshold = 0.82
      _model_threshold    = 0.65

      def script_description():
          return (
              "<b>RSL Hero Auto-Detector</b><br>"
              "Detects active hero on screen and pushes to OBS overlay via WebSocket."
          )

      def script_properties():
          props = obs.obs_properties_create()
          obs.obs_properties_add_text(props, _S_PORTRAITS, "Portraits DB path", obs.OBS_TEXT_DEFAULT)
          obs.obs_properties_add_text(props, _S_MODELS,    "Models DB path",    obs.OBS_TEXT_DEFAULT)
          obs.obs_properties_add_int(  props, _S_PORT,     "WebSocket port",    1024, 65535, 1)
          obs.obs_properties_add_int(  props, _S_INTERVAL, "Detection interval (ms)", 500, 10000, 100)
          obs.obs_properties_add_float(props, _S_P_THRESH, "Portrait confidence threshold", 0.0, 1.0, 0.01)
          obs.obs_properties_add_float(props, _S_M_THRESH, "Model confidence threshold",   0.0, 1.0, 0.01)
          obs.obs_properties_add_button(props, "clear_cache", "Clear battle cache", _on_clear_cache)
          return props

      def script_defaults(settings):
          obs.obs_data_set_default_string(settings, _S_PORTRAITS, r"C:\path\to\data\portraits")
          obs.obs_data_set_default_string(settings, _S_MODELS,    r"C:\path\to\data\models")
          obs.obs_data_set_default_int(   settings, _S_PORT,      7182)
          obs.obs_data_set_default_int(   settings, _S_INTERVAL,  1500)
          obs.obs_data_set_default_double(settings, _S_P_THRESH,  0.82)
          obs.obs_data_set_default_double(settings, _S_M_THRESH,  0.65)

      def script_update(settings):
          global _portraits_path, _models_path, _ws_port, _interval_ms
          global _portrait_threshold, _model_threshold
          _portraits_path     = obs.obs_data_get_string(settings, _S_PORTRAITS)
          _models_path        = obs.obs_data_get_string(settings, _S_MODELS)
          _ws_port            = obs.obs_data_get_int(   settings, _S_PORT)
          _interval_ms        = obs.obs_data_get_int(   settings, _S_INTERVAL)
          _portrait_threshold = obs.obs_data_get_double(settings, _S_P_THRESH)
          _model_threshold    = obs.obs_data_get_double(settings, _S_M_THRESH)

      def script_load(settings):
          global _server, _db
          _server = DetectorServer(port=_ws_port)
          _server.start()
          _db = HeroDatabase(_portraits_path, _models_path)
          try:
              _db.load()
              obs.script_log(obs.LOG_INFO,
                  f"[hero-detector] Loaded {len(_db.portraits)} portraits, {len(_db.models)} models")
          except Exception as e:
              obs.script_log(obs.LOG_WARNING, f"[hero-detector] DB load failed: {e}")
          obs.timer_add(_detect_tick, _interval_ms)

      def script_unload():
          obs.timer_remove(_detect_tick)
          if _server:
              _server.stop()

      def _on_clear_cache(props, prop):
          _cache.clear()
          obs.script_log(obs.LOG_INFO, "[hero-detector] Battle cache cleared")
          return True

      def _detect_tick():
          global _last_hero_id
          if _db is None or _server is None:
              return
          frame = capture_screen()
          if frame is None:
              return

          hero_id = detect_roster_hero(frame, _db, threshold=_portrait_threshold)

          if hero_id is None:
              circle = find_active_circle(frame)
              if circle:
                  cx, cy, _team = circle
                  hero_id = detect_battle_hero(frame, cx, cy, _db, _cache,
                                               threshold=_model_threshold)

          if hero_id and hero_id != _last_hero_id:
              _server.push({"type": "hero", "id": hero_id})
              _last_hero_id = hero_id
          elif not hero_id and _last_hero_id:
              _server.push({"type": "hero", "id": None})
              _last_hero_id = None

  except ImportError:
      pass  # Running outside OBS (pytest, etc.)
  ```

- [ ] **Step 2: Verify pytest still passes**

  ```bash
  pytest tests/ -v
  ```

  Expected: all tests PASS (the OBS block is skipped via `try/except`).

- [ ] **Step 3: Manual test in OBS**

  1. OBS → Tools → Scripts → Python Settings → verify Python path
  2. Click `+` → load `d:\projects\twitch-extension-private\tools\hero_detector.py`
  3. Set **Portraits DB path** to `d:\projects\twitch-extension-private\data\portraits`
  4. Set **Models DB path** to `d:\projects\twitch-extension-private\data\models`
  5. OBS → View → Script Log → expect: `[hero-detector] Loaded N portraits, M models`
  6. If you see `DB load failed` — verify the paths exist and have PNG files

- [ ] **Step 4: Commit**

  ```bash
  git add tools/hero_detector.py
  git commit -m "feat: add OBS Python bindings to hero detector script"
  ```

---

## Task 9: Model DB Builder

**Files:**
- Create: `d:\projects\twitch-extension-private\tools\extract_models.py`

- [ ] **Step 1: Create the script**

  ```python
  """Semi-automated 3D model screenshot capture.

  Usage:
    python tools/extract_models.py

  For each hero without a model PNG, prints the hero name and waits for
  ENTER (while you navigate to that hero in-game). Then captures a
  screenshot, crops the model region, and saves data/models/{hero_id}.png.
  Press 's'+ENTER to skip; 'q'+ENTER to quit.
  """
  import json
  import cv2
  import numpy as np
  from pathlib import Path
  from PIL import ImageGrab

  HEROES_JSON = Path(__file__).parent.parent / "data" / "heroes.json"
  MODELS_DIR  = Path(__file__).parent.parent / "data" / "models"

  # Fraction of screen to crop for the hero model (left, top, right, bottom).
  # Calibrate once for your resolution by examining a full-screen screenshot.
  MODEL_ROI = (0.30, 0.05, 0.70, 0.90)


  def crop_model(bgr: np.ndarray) -> np.ndarray:
      h, w = bgr.shape[:2]
      x1, y1 = int(w * MODEL_ROI[0]), int(h * MODEL_ROI[1])
      x2, y2 = int(w * MODEL_ROI[2]), int(h * MODEL_ROI[3])
      return bgr[y1:y2, x1:x2]


  def main():
      MODELS_DIR.mkdir(parents=True, exist_ok=True)
      heroes = json.loads(HEROES_JSON.read_text(encoding="utf-8"))
      todo = [h for h in heroes if not (MODELS_DIR / f"{h['id']}.png").exists()]
      print(f"{len(todo)} heroes need model screenshots ({len(heroes)} total)\n")

      for i, hero in enumerate(todo, 1):
          print(f"[{i}/{len(todo)}] Navigate to '{hero['name']}' in the game roster.")
          cmd = input("  ENTER=capture  s=skip  q=quit: ").strip().lower()
          if cmd == "q":
              print("Stopped.")
              break
          if cmd == "s":
              print("  Skipped.")
              continue
          frame = cv2.cvtColor(np.array(ImageGrab.grab()), cv2.COLOR_RGB2BGR)
          dest  = MODELS_DIR / f"{hero['id']}.png"
          cv2.imwrite(str(dest), crop_model(frame))
          print(f"  Saved {dest}")


  if __name__ == "__main__":
      main()
  ```

- [ ] **Step 2: Calibrate `MODEL_ROI` for your screen**

  Take a screenshot while viewing a hero in the in-game roster. Open it in Paint, note the pixel coordinates of the hero model area, and convert to fractions of screen width/height. Update `MODEL_ROI` in the script.

- [ ] **Step 3: Capture a test batch of 5 heroes**

  ```bash
  cd d:\projects\twitch-extension-private
  python tools/extract_models.py
  ```

  Verify the saved PNGs in `data/models/` show clear hero model crops (no UI clutter).

- [ ] **Step 4: Commit**

  ```bash
  git add tools/extract_models.py
  git commit -m "feat: add semi-automated model DB screenshot tool"
  ```

---

## Task 10: obs.js WebSocket Client

**Files:**
- Modify: `d:\projects\twitch-extension\obs\obs.js`

Key existing names confirmed from reading the file:
- `heroes` — array (line 10), populated at line 25 inside `init()`
- `showHeroCard(hero, skillIdx)` — line 225
- `dismissCard()` — line 313
- `init()` — called at line 319

- [ ] **Step 1: Add constants near the top of `obs/obs.js`**

  After line 17 (`let dismissCountdown = null;`), add:

  ```javascript
  const DETECTOR_WS_PORT = 7182;
  const DETECTOR_WS_RECONNECT_BASE_MS = 1000;
  const DETECTOR_WS_RECONNECT_MAX_MS = 30000;
  let _detectorAutoShown = false;
  let _detectorReconnectDelay = DETECTOR_WS_RECONNECT_BASE_MS;
  ```

- [ ] **Step 2: Add `connectDetector()` function**

  After the `dismissCard()` function (after line 317), add:

  ```javascript
  function connectDetector() {
    let ws;
    try {
      ws = new WebSocket(`ws://localhost:${DETECTOR_WS_PORT}`);
    } catch {
      scheduleDetectorReconnect();
      return;
    }

    ws.onopen = () => {
      _detectorReconnectDelay = DETECTOR_WS_RECONNECT_BASE_MS;
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type !== 'hero') return;

      if (msg.id) {
        const hero = heroes.find(h => h.id === msg.id);
        if (hero) {
          showHeroCard(hero, 0);
          _detectorAutoShown = true;
        }
      } else if (_detectorAutoShown) {
        dismissCard();
        _detectorAutoShown = false;
      }
    };

    ws.onclose = () => scheduleDetectorReconnect();
    ws.onerror = () => ws.close();
  }

  function scheduleDetectorReconnect() {
    setTimeout(() => {
      _detectorReconnectDelay = Math.min(_detectorReconnectDelay * 2, DETECTOR_WS_RECONNECT_MAX_MS);
      connectDetector();
    }, _detectorReconnectDelay);
  }
  ```

- [ ] **Step 3: Call `connectDetector()` inside `init()` after heroes are loaded**

  In `obs/obs.js`, inside `init()`, after line 25 (`heroes = await loadHeroes(...)`), add:

  ```javascript
  connectDetector();
  ```

- [ ] **Step 4: Reset `_detectorAutoShown` when user manually selects a hero**

  In `handleHeroListClick` (around line 161–167), after `showHeroCard(hero)`, add:

  ```javascript
  _detectorAutoShown = false;
  ```

  This ensures manual selections are never auto-dismissed by the detector's `id: null` message.

- [ ] **Step 5: Manual integration test**

  1. Start OBS with `hero_detector.py` loaded (portrait DB populated from Task 2)
  2. Open OBS Browser Source pointing to `obs.html`
  3. Right-click the browser source → Interact → open DevTools console
  4. Expected console: no WebSocket connection errors (connection may fail silently if detector not running — that's OK, it will retry)
  5. With the detector running: open RSL, navigate to any hero in the collection
  6. Expected: within 2s the hero card appears in the OBS overlay automatically

- [ ] **Step 6: Commit**

  ```bash
  cd d:\projects\twitch-extension
  git add obs/obs.js
  git commit -m "feat: add WebSocket client for auto-hero detection in OBS overlay"
  ```

---

## Coverage Check

| Spec requirement | Implemented in |
|-----------------|----------------|
| OBS Python script, WS server | Tasks 3, 8 |
| Portrait DB downloader | Task 2 |
| pHash pre-filter (portraits + models) | Task 4 |
| Roster ROI portrait matching | Task 5 |
| HSV green/red circle detection | Task 6 |
| ORB model matching on top candidates | Task 7 |
| Battle cache (position → hero_id) | Task 7 |
| `detect_battle_hero` with cache check | Task 7 |
| OBS script properties panel | Task 8 |
| Model DB builder tool | Task 9 |
| obs.js WebSocket client | Task 10 |
| Auto-dismiss on `{id: null}` | Task 10 |
| Reconnect with exponential backoff | Task 10 |
| Manual card not auto-dismissed | Task 10 step 4 |
