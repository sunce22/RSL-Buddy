// panel/panel.js
import { loadHeroes, buildEffectsIndex, buildEffectsList, filterHeroesByName, filterEffects } from '../shared/data.js';
import { renderHeroCard, heroPortraitUrl } from '../shared/hero-card.js';
import { renderEffectItem } from '../shared/effects-list.js';
import { escapeHtml } from '../shared/utils.js';
import { initFeedbackForm } from '../shared/feedback.js';
import { getLang, setLang, loadTranslations, t, translateHero, updateLangButtons, isTranslationsLoaded } from '../shared/i18n.js';

let heroes = [];
let effectsIndex = {};
let effectsList = [];
let activeTab = 'heroes';
let expandedHeroId = null;
let expandedHeroSkillIdx = 0;
let expandedEffectSlug = null;

async function init() {
  heroes = await loadHeroes('../data/heroes.json');
  effectsIndex = buildEffectsIndex(heroes);
  effectsList = buildEffectsList(effectsIndex);

  if (getLang() === 'uk') await loadTranslations();
  updateLangButtons();
  applyStaticStrings();

  const savedTab = localStorage.getItem('rsl-tab');
  if (savedTab === 'effects') switchTab('effects'); else renderHeroesTab();

  document.getElementById('tab-heroes').addEventListener('click', () => switchTab('heroes'));
  document.getElementById('tab-effects').addEventListener('click', () => switchTab('effects'));
  document.getElementById('tab-support').addEventListener('click', toggleSupport);
  initFeedbackForm(document.getElementById('support-modal'), 'Panel');
  document.getElementById('tab-content').addEventListener('click', handleClick);
  document.getElementById('tab-content').addEventListener('input', handleInput);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      if (getLang() === lang) return;
      setLang(lang);
      if (lang === 'uk') await loadTranslations();
      updateLangButtons();
      applyStaticStrings();
      if (activeTab === 'heroes') renderHeroesTab(document.getElementById('search-heroes')?.value ?? '');
      else renderEffectsTab(document.getElementById('search-effects')?.value ?? '');
    });
  });
}

function applyStaticStrings() {
  document.getElementById('tab-heroes').textContent = t('tab_heroes');
  document.getElementById('tab-effects').textContent = t('tab_effects');
  document.getElementById('tab-support').textContent = t('tab_support');
  const fbInput = document.querySelector('.feedback-input');
  if (fbInput) fbInput.placeholder = t('feedback_placeholder');
  const fbSubmit = document.querySelector('.feedback-submit');
  if (fbSubmit) fbSubmit.textContent = t('feedback_submit');
}

function toggleSupport() {
  const modal = document.getElementById('support-modal');
  modal.classList.toggle('support-modal--hidden');
}

function switchTab(tab, opts = {}) {
  activeTab = tab;
  localStorage.setItem('rsl-tab', tab);
  document.getElementById('tab-heroes').classList.toggle('tab--active', tab === 'heroes');
  document.getElementById('tab-effects').classList.toggle('tab--active', tab === 'effects');
  if (tab === 'heroes') {
    expandedHeroId = opts.heroId ?? null;
    renderHeroesTab();
  } else {
    expandedEffectSlug = opts.effectSlug ?? null;
    renderEffectsTab();
  }
}

function handleClick(e) {
  if (e.target.closest('.hero-back')) {
    expandedHeroId = null;
    renderHeroesTab(document.getElementById('search-heroes')?.value ?? '');
    return;
  }
  const heroItem = e.target.closest('.hero-item');
  const effectItem = e.target.closest('.effect-item');
  const effectTag = e.target.closest('.effect-tag');
  const heroLink = e.target.closest('.effect-entry__hero');

  const skillTab = e.target.closest('.skill-tab');
  if (skillTab) {
    expandedHeroSkillIdx = parseInt(skillTab.dataset.skillIdx, 10);
    renderHeroesTab(document.getElementById('search-heroes')?.value ?? '');
    return;
  }
  if (effectTag) {
    switchTab('effects', { effectSlug: effectTag.dataset.effect });
    return;
  }
  if (heroLink) {
    switchTab('heroes', { heroId: heroLink.dataset.heroId });
    return;
  }
  if (heroItem) {
    const id = heroItem.dataset.heroId;
    if (expandedHeroId !== id) expandedHeroSkillIdx = 0;
    expandedHeroId = expandedHeroId === id ? null : id;
    renderHeroesTab(document.getElementById('search-heroes')?.value ?? '');
    return;
  }
  if (effectItem) {
    const slug = effectItem.dataset.effect;
    expandedEffectSlug = expandedEffectSlug === slug ? null : slug;
    renderEffectsTab(document.getElementById('search-effects')?.value ?? '');
  }
}

function handleInput(e) {
  if (e.target.id === 'search-heroes') renderHeroesTab(e.target.value, true);
  if (e.target.id === 'search-effects') renderEffectsTab(e.target.value, true);
}

function renderHeroesTab(query = '', fromSearch = false) {
  const q = query.trim().toLowerCase();
  const translated = heroes.map(hero => ({ orig: hero, h: translateHero(hero) }));
  const filtered = q
    ? translated.filter(({ orig, h }) => {
        if (orig.name.toLowerCase().includes(q)) return true;
        // Only search translated names when translations are actually loaded
        if (isTranslationsLoaded() && h.name !== orig.name && h.name.toLowerCase().includes(q)) return true;
        return false;
      })
    : translated;
  const content = document.getElementById('tab-content');

  const listHtml = filtered.map(({ orig: hero, h }) => `
    <div class="hero-item${expandedHeroId === hero.id ? ' hero-item--active' : ''}" data-hero-id="${escapeHtml(hero.id)}">
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
    </div>
    ${expandedHeroId === hero.id ? `<div class="hero-detail"><button class="hero-back">${escapeHtml(t('back'))}</button>${renderHeroCard(h, expandedHeroSkillIdx)}</div>` : ''}
  `).join('');

  // Preserve search input to avoid IME composition break on Cyrillic input
  const existingInput = document.getElementById('search-heroes');
  if (existingInput && fromSearch) {
    const list = content.querySelector('.heroes-list');
    if (list) {
      list.innerHTML = listHtml;
      // Restore focus — updating innerHTML of sibling can blur the input in some browsers
      existingInput.focus();
      return;
    }
  }

  content.innerHTML = `
<div class="heroes-tab">
  <input type="text" id="search-heroes" class="search-input" placeholder="${escapeHtml(t('search_heroes'))}" value="${escapeHtml(query)}">
  <div class="heroes-list">${listHtml}</div>
</div>`;
  if (fromSearch) {
    const input = document.getElementById('search-heroes');
    if (input) input.focus();
  }
}

function renderEffectsTab(query = '', fromSearch = false) {
  const filtered = filterEffects(effectsList, query);
  const content = document.getElementById('tab-content');
  content.innerHTML = `
<div class="effects-tab">
  <input type="text" id="search-effects" class="search-input" placeholder="${escapeHtml(t('search_effects'))}" value="${escapeHtml(query)}">
  <div class="effects-list-container">
    ${filtered.map(effect => {
      const rawEntries = effectsIndex[effect.slug] ?? [];
      const entries = rawEntries.map(({ hero, skill }) => {
        const th = translateHero(hero);
        const idx = hero.skills.indexOf(skill);
        return { hero: th, skill: idx >= 0 ? th.skills[idx] : skill };
      });
      return renderEffectItem(effect, entries, expandedEffectSlug === effect.slug);
    }).join('')}
  </div>
</div>`;
  if (fromSearch) {
    const input = document.getElementById('search-effects');
    if (input) { input.focus(); input.setSelectionRange(query.length, query.length); }
  }
}

init().catch(err => {
  const el = document.getElementById('tab-content');
  if (el) el.textContent = `${t('error_loading')} ${err.message}`;
});
