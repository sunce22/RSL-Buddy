// obs/obs.js
import { loadHeroes, buildEffectsIndex, buildEffectsList, filterHeroesByName, filterEffects } from '../shared/data.js?v=2';
import { renderHeroCard, heroPortraitUrl } from '../shared/hero-card.js?v=2';
import { renderEffectItem } from '../shared/effects-list.js?v=2';
import { escapeHtml, slugToLabel } from '../shared/utils.js?v=2';
import { EFFECT_DESCRIPTIONS } from '../shared/effect-descriptions.js?v=2';
import { initFeedbackForm } from '../shared/feedback.js';
import { getLang, setLang, loadTranslations, t, translateHero, updateLangButtons, isTranslationsLoaded } from '../shared/i18n.js';

let heroes = [];
let effectsIndex = {};
let effectsList = [];
let activeControlTab = 'heroes';
let overlayHero = null;
let overlaySkillIdx = 0;
let dismissTimer = null;
let dismissCountdown = null;

function getDismissSeconds() {
  if (document.getElementById('obs-nolimit')?.checked) return 0;
  return Math.max(1, parseInt(document.getElementById('obs-duration')?.value ?? '8', 10) || 8);
}

async function init() {
  heroes = await loadHeroes('../data/heroes.json');
  effectsIndex = buildEffectsIndex(heroes);
  effectsList = buildEffectsList(effectsIndex);
  if (getLang() === 'uk') await loadTranslations();
  updateLangButtons();
  applyObsStaticStrings();
  renderHeroesList('');

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      if (getLang() === lang) return;
      setLang(lang);
      if (lang === 'uk') await loadTranslations();
      updateLangButtons();
      applyObsStaticStrings();
      renderHeroesList(document.getElementById('obs-search-heroes')?.value ?? '');
      if (activeControlTab === 'effects') renderEffectsList(document.getElementById('obs-search-effects')?.value ?? '');
      if (overlayHero) showHeroCard(overlayHero, overlaySkillIdx);
    });
  });

  document.getElementById('toggle-control').addEventListener('click', toggleControl);
  document.getElementById('close-control').addEventListener('click', closeControl);
  document.getElementById('obs-tab-heroes').addEventListener('click', () => switchControlTab('heroes'));
  document.getElementById('obs-tab-effects').addEventListener('click', () => switchControlTab('effects'));
  document.getElementById('obs-tab-support').addEventListener('click', () => switchControlTab('support'));
  document.getElementById('obs-search-heroes').addEventListener('input', e => renderHeroesList(e.target.value));
  document.getElementById('obs-search-effects').addEventListener('input', e => renderEffectsList(e.target.value));
  document.getElementById('obs-heroes-list').addEventListener('click', handleHeroListClick);
  document.getElementById('obs-effects-list').addEventListener('click', handleEffectsListClick);
  document.getElementById('obs-support').addEventListener('click', handleSupportClick);
  initFeedbackForm(document.getElementById('obs-support'), 'OBS');
  document.getElementById('card-overlay').addEventListener('click', handleOverlayClick);

  document.addEventListener('keydown', e => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    if (e.key === 'c' || e.key === 'C') toggleControl();
    if (e.key === 'd' || e.key === 'D') dismissCard();
    if (e.key === 'Escape') { closeControl(); dismissCard(); }
  });
}

function applyObsStaticStrings() {
  document.getElementById('obs-tab-heroes').textContent = t('tab_heroes');
  document.getElementById('obs-tab-effects').textContent = t('tab_effects');
  document.getElementById('obs-tab-support').textContent = t('tab_support');
  const search = document.getElementById('obs-search-heroes');
  if (search) search.placeholder = t('search_heroes');
  const searchEff = document.getElementById('obs-search-effects');
  if (searchEff) searchEff.placeholder = t('search_effects');
  const fbInput = document.querySelector('#obs-support .feedback-input');
  if (fbInput) fbInput.placeholder = t('feedback_placeholder');
  const fbSubmit = document.querySelector('#obs-support .feedback-submit');
  if (fbSubmit) fbSubmit.textContent = t('feedback_submit');
  const supportTitle = document.querySelector('.obs-support__title');
  if (supportTitle) supportTitle.textContent = t('support_title');
  const visLabel = document.querySelector('.control-panel__duration label');
  if (visLabel && visLabel.firstChild?.nodeType === Node.TEXT_NODE) {
    visLabel.firstChild.data = t('obs_visible') + ' ';
  }
}

function switchControlTab(tab) {
  activeControlTab = tab;
  document.getElementById('obs-tab-heroes').classList.toggle('obs-tab--active', tab === 'heroes');
  document.getElementById('obs-tab-effects').classList.toggle('obs-tab--active', tab === 'effects');
  document.getElementById('obs-tab-support').classList.toggle('obs-tab--active', tab === 'support');
  document.getElementById('obs-search-heroes').style.display = tab === 'heroes' ? '' : 'none';
  document.getElementById('obs-search-effects').style.display = tab === 'effects' ? '' : 'none';
  document.getElementById('obs-heroes-list').style.display = tab === 'heroes' ? '' : 'none';
  document.getElementById('obs-effects-list').style.display = tab === 'effects' ? '' : 'none';
  document.getElementById('obs-support').style.display = tab === 'support' ? '' : 'none';
  if (tab === 'effects' && document.getElementById('obs-effects-list').innerHTML === '') {
    renderEffectsList('');
  }
}

function toggleControl() {
  const panel = document.getElementById('control-panel');
  const hidden = panel.classList.toggle('control-panel--hidden');
  if (!hidden) {
    dismissCard();
    if (activeControlTab !== 'support') {
      const searchId = activeControlTab === 'heroes' ? 'obs-search-heroes' : 'obs-search-effects';
      document.getElementById(searchId).focus();
    }
  }
}

function closeControl() {
  document.getElementById('control-panel').classList.add('control-panel--hidden');
}

function renderHeroesList(query) {
  const q = (query ?? '').trim().toLowerCase();
  const translated = heroes.map(hero => ({ orig: hero, h: translateHero(hero) }));
  const filtered = q
    ? translated.filter(({ orig, h }) => {
        if (orig.name.toLowerCase().includes(q)) return true;
        if (isTranslationsLoaded() && h.name !== orig.name && h.name.toLowerCase().includes(q)) return true;
        return false;
      })
    : translated;
  const searchInput = document.getElementById('obs-search-heroes');
  const panel = document.getElementById('control-panel');
  document.getElementById('obs-heroes-list').innerHTML = filtered.map(({ orig: hero, h }) => `
    <div class="hero-item" data-hero-id="${escapeHtml(hero.id)}">
      <div class="hero-item__body">
        <img class="hero-thumb" src="${escapeHtml(heroPortraitUrl(hero))}" alt="" loading="lazy" width="36" height="47" referrerpolicy="no-referrer" onerror="this.style.display='none'">
        <div class="hero-item__text">
          <div class="hero-item__name">${escapeHtml(h.name)}</div>
          <div class="hero-item__meta">
            <span class="badge badge--${hero.affinity.toLowerCase()}">${escapeHtml(hero.affinity)}</span>
            <span class="hero-item__faction">${escapeHtml(hero.faction)}</span>
          </div>
        </div>
      </div>
    </div>`).join('');
  // Restore focus only when panel is open and input doesn't already have focus
  if (searchInput && panel && !panel.classList.contains('control-panel--hidden') && document.activeElement !== searchInput) searchInput.focus();
}

function renderEffectsList(query) {
  const filtered = filterEffects(effectsList, query);
  document.getElementById('obs-effects-list').innerHTML = filtered.map(effect => {
    const rawEntries = effectsIndex[effect.slug] ?? [];
    const entries = rawEntries.map(({ hero, skill }) => {
      const th = translateHero(hero);
      const idx = hero.skills.indexOf(skill);
      return { hero: th, skill: idx >= 0 ? th.skills[idx] : skill };
    });
    return renderEffectItem(effect, entries, false);
  }).join('');
}

function handleHeroListClick(e) {
  const item = e.target.closest('.hero-item');
  if (!item) return;
  const hero = heroes.find(h => h.id === item.dataset.heroId);
  if (!hero) return;
  showHeroCard(hero);
  closeControl();
}

function copyText(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (_) {}
}

function handleSupportClick(e) {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  copyText(btn.dataset.copy);
  const orig = btn.textContent;
  btn.textContent = t('obs_copied');
  btn.classList.add('copied');
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
}

function handleEffectsListClick(e) {
  const effectItem = e.target.closest('.effect-item');
  if (effectItem) {
    const slug = effectItem.dataset.effect;
    const entries = effectsIndex[slug] ?? [];
    const effect = effectsList.find(ef => ef.slug === slug);
    if (effect) { showEffectCard(effect, entries); closeControl(); }
    return;
  }
  const heroLink = e.target.closest('.effect-entry__hero');
  if (heroLink) {
    const hero = heroes.find(h => h.id === heroLink.dataset.heroId);
    if (hero) { showHeroCard(hero); closeControl(); }
  }
}

function handleOverlayClick(e) {
  if (e.target.closest('.card-overlay__dismiss')) { dismissCard(); return; }
  const skillTab = e.target.closest('.skill-tab');
  if (skillTab && overlayHero) {
    overlaySkillIdx = parseInt(skillTab.dataset.skillIdx, 10);
    rerenderHeroCard();
    return;
  }
  const effectTag = e.target.closest('.effect-tag');
  if (effectTag) {
    const slug = effectTag.dataset.effect;
    const entries = effectsIndex[slug] ?? [];
    const effect = effectsList.find(ef => ef.slug === slug) ?? { slug, label: slugToLabel(slug) };
    showEffectCard(effect, entries);
  }
}

function showHeroCard(hero, skillIdx = 0) {
  overlayHero = hero;
  overlaySkillIdx = skillIdx;
  const totalSeconds = getDismissSeconds();
  const timerText = totalSeconds === 0 ? '' : `${t('obs_timer')} ${totalSeconds}s`;
  const overlay = document.getElementById('card-overlay');
  overlay.innerHTML = buildHeroCardHtml(hero, overlaySkillIdx, timerText);
  overlay.classList.remove('card-overlay--hidden');
  startDismissTimer(totalSeconds);
}

function rerenderHeroCard() {
  const overlay = document.getElementById('card-overlay');
  const timerText = overlay.querySelector('#dismiss-timer')?.textContent ?? null;
  overlay.innerHTML = buildHeroCardHtml(overlayHero, overlaySkillIdx, timerText);
}

function buildHeroCardHtml(hero, skillIdx, timerText) {
  const displayHero = translateHero(hero);
  const timerHtml = timerText
    ? `<div class="card-overlay__timer" id="dismiss-timer">${timerText}</div>`
    : '';
  return `
    <button class="card-overlay__dismiss">✕</button>
    <div class="card-overlay__hero-name">${escapeHtml(displayHero.name)}</div>
    ${renderHeroCard(displayHero, skillIdx)}
    ${timerHtml}
  `;
}

function showEffectCard(effect, entries) {
  const totalSeconds = getDismissSeconds();
  const timerText = totalSeconds === 0 ? '' : `${t('obs_timer')} ${totalSeconds}s`;
  const overlay = document.getElementById('card-overlay');
  const desc = EFFECT_DESCRIPTIONS[effect.slug];
  const descHtml = desc ? `<div class="effect-description">${escapeHtml(desc)}</div>` : '';
  const translatedEntries = entries.map(({ hero, skill }) => {
    const th = translateHero(hero);
    const idx = hero.skills.indexOf(skill);
    return { hero: th, skill: idx >= 0 ? th.skills[idx] : skill };
  });
  const shown = translatedEntries.slice(0, 20);
  const more = translatedEntries.length > 20
    ? `<div style="font-size:10px;color:var(--text-muted);padding-top:4px">+${translatedEntries.length - 20} more</div>`
    : '';
  const entriesHtml = shown.map(({ hero, skill }) => `
    <div class="effect-entry">
      <button class="effect-entry__hero" data-hero-id="${escapeHtml(hero.id)}">${escapeHtml(hero.name)}</button>
      <div class="effect-entry__skill">${escapeHtml(skill.name)}${skill.cooldown > 0 ? ` · ${t('cooldown_prefix')} ${skill.cooldown}` : ''}</div>
    </div>`).join('');
  const timerHtml = timerText
    ? `<div class="card-overlay__timer" id="dismiss-timer">${timerText}</div>`
    : '';
  overlay.innerHTML = `
    <button class="card-overlay__dismiss">✕</button>
    <div class="card-overlay__hero-name">${escapeHtml(effect.label)}</div>
    ${descHtml}
    <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px">${translatedEntries.length} hero${translatedEntries.length !== 1 ? 'es' : ''}</div>
    <div class="effect-entries" style="display:block;max-height:300px;overflow-y:auto">${entriesHtml}${more}</div>
    ${timerHtml}
  `;
  overlay.classList.remove('card-overlay--hidden');
  // hero links inside effect card switch back to hero card
  overlay.querySelectorAll('.effect-entry__hero').forEach(btn => {
    btn.addEventListener('click', e => {
      const hero = heroes.find(h => h.id === e.currentTarget.dataset.heroId);
      if (hero) showHeroCard(hero);
    });
  });
  startDismissTimer(totalSeconds);
}

function startDismissTimer(totalSeconds) {
  clearTimeout(dismissTimer);
  clearInterval(dismissCountdown);
  if (totalSeconds === 0) return;
  let remaining = totalSeconds;
  dismissCountdown = setInterval(() => {
    remaining -= 1;
    const el = document.getElementById('dismiss-timer');
    if (el) el.textContent = `${t('obs_timer')} ${remaining}s`;
  }, 1000);
  dismissTimer = setTimeout(() => {
    clearInterval(dismissCountdown);
    dismissCard();
  }, totalSeconds * 1000);
}

function dismissCard() {
  clearTimeout(dismissTimer);
  clearInterval(dismissCountdown);
  document.getElementById('card-overlay').classList.add('card-overlay--hidden');
}

init().catch(err => console.error('OBS init error:', err));
