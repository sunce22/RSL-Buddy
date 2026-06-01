// shared/hero-card.js
import { escapeHtml, slugToLabel } from './utils.js';
import { highlightDescription } from './effect-descriptions.js';
import { effectLabel, t } from './i18n.js';

export function heroPortraitUrl(hero) {
  if (hero.portrait) return hero.portrait;
  const small = new Set(['the', 'of', 'a', 'an', 'and', 'in', 'at', 'by', 'for']);
  const slug = hero.name
    .replace(/'/g, '')
    .split(/[\s\-,]+/)
    .filter(Boolean)
    .map(w => small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join('_');
  return `https://ayumilove.net/files/games/raid_shadow_legends/champion/${slug}.jpg`;
}

// activeSkillIdx = null → show all skills (OBS)
// activeSkillIdx = number → show skill tabs + single skill (Panel)
export function renderHeroCard(hero, activeSkillIdx = null) {
  const skills = hero.skills;
  const hasForms = skills.some(s => s.form);
  const FORM_PREFIX = { base: 'B· ', alternate: 'A· ', common: '' };

  let bodyHtml;
  if (activeSkillIdx !== null && skills.length > 0) {
    const idx = Math.min(activeSkillIdx, skills.length - 1);
    const tabsHtml = skills.map((s, i) => {
      const prefix = hasForms ? (FORM_PREFIX[s.form] ?? '') : '';
      return `<button class="skill-tab${i === idx ? ' skill-tab--active' : ''}" data-skill-idx="${i}">${prefix}${escapeHtml(s.name)}</button>`;
    }).join('');
    bodyHtml = `<div class="skill-tabs">${tabsHtml}</div><div class="skill-panel">${renderSkill(skills[idx])}</div>`;
  } else if (hasForms) {
    const groups = { base: [], alternate: [], common: [] };
    for (const s of skills) groups[s.form ?? 'common'].push(s);
    const LABELS = { base: 'Base Form', alternate: 'Alternate Form', common: 'Common' };
    bodyHtml = ['base', 'alternate', 'common']
      .filter(f => groups[f].length > 0)
      .map(f => `<div class="form-section"><div class="form-section__label">${LABELS[f]}</div>${groups[f].map(renderSkill).join('')}</div>`)
      .join('');
  } else {
    bodyHtml = skills.map(renderSkill).join('');
  }

  return `
<div class="hero-card" data-hero-id="${hero.id}">
  <div class="hero-card__header">
    <img class="hero-portrait" src="${escapeHtml(heroPortraitUrl(hero))}" alt="" loading="lazy" width="72" height="94" referrerpolicy="no-referrer" onerror="this.style.display='none'">
    <div class="hero-card__info">
      <div class="hero-card__name">${escapeHtml(hero.name)}</div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px">
        <span class="badge badge--${hero.rarity.toLowerCase()}">${escapeHtml(hero.rarity)}</span>
        <span class="badge badge--${hero.affinity.toLowerCase()}">${escapeHtml(hero.affinity)}</span>
        <span style="color:var(--text-muted);font-size:11px">${escapeHtml(hero.faction)}</span>
      </div>
    </div>
  </div>
  <div class="hero-card__skills">${bodyHtml}</div>
</div>`.trim();
}

function renderSkill(skill) {
  const cdHtml = skill.cooldown > 0
    ? `<span class="skill__cooldown">${t('cooldown_prefix')} ${skill.cooldown}</span>`
    : '';
  const effectTagsHtml = skill.effects.length > 0
    ? `<div class="skill__effects">${skill.effects.map(slug =>
        `<button class="effect-tag" data-effect="${escapeHtml(slug)}">${escapeHtml(effectLabel(slug) ?? slugToLabel(slug))}</button>`
      ).join('')}</div>`
    : '';
  return `
<div class="skill">
  <div class="skill__header">
    <span class="skill__name">${escapeHtml(skill.name)}</span>${cdHtml}
  </div>
  <p class="skill__description">${highlightDescription(skill.description)}</p>
  ${effectTagsHtml}
</div>`.trim();
}
