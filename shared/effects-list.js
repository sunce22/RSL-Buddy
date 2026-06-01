// shared/effects-list.js
import { escapeHtml } from './utils.js';
import { EFFECT_DESCRIPTIONS } from './effect-descriptions.js';
import { effectLabel, t } from './i18n.js';

export function renderEffectItem(effect, entries, expanded = false) {
  const desc = EFFECT_DESCRIPTIONS[effect.slug];
  const descHtml = desc
    ? `<div class="effect-description">${escapeHtml(desc)}</div>`
    : '';
  const entriesHtml = entries.map(({ hero, skill }) => `
<div class="effect-entry">
  <button class="effect-entry__hero" data-hero-id="${escapeHtml(hero.id)}">${escapeHtml(hero.name)}</button>
  <div class="effect-entry__skill">
    ${escapeHtml(skill.name)}${skill.cooldown > 0 ? ` · ${t('cooldown_prefix')} ${skill.cooldown}` : ''}
    <br><span style="font-size:10px">${escapeHtml(skill.description)}</span>
  </div>
</div>`).join('');

  return `
<div class="effect-item" data-effect="${escapeHtml(effect.slug)}">
  <div class="effect-item__label">${escapeHtml(effectLabel(effect.slug) ?? effect.label)}</div>
  <div class="effect-item__count">${entries.length} hero${entries.length !== 1 ? 'es' : ''}</div>
</div>
<div class="effect-entries" data-effect="${escapeHtml(effect.slug)}"${expanded ? '' : ' hidden'}>
  ${descHtml}
  ${entriesHtml}
</div>`.trim();
}
