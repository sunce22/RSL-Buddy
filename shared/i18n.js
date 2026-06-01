// shared/i18n.js
const LANG_KEY = 'rsl-lang';

export function getLang() {
  if (typeof localStorage === 'undefined') return 'en';
  return localStorage.getItem(LANG_KEY) ?? 'en';
}

export function setLang(lang) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LANG_KEY, lang);
}

let _heroTr = null;
let _uiTr   = null;
let _loading = null; // prevent double-load

export function isTranslationsLoaded() { return _heroTr !== null; }

export async function loadTranslations() {
  if (_loading) return _loading;
  _loading = Promise.allSettled([
    fetch('../i18n/heroes-uk.json').then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }),
    fetch('../i18n/ui-uk.json').then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }),
  ]).then(([heroRes, uiRes]) => {
    if (heroRes.status === 'rejected') console.warn('i18n: heroes-uk.json failed', heroRes.reason);
    if (uiRes.status   === 'rejected') console.warn('i18n: ui-uk.json failed', uiRes.reason);
    _heroTr = heroRes.status === 'fulfilled' ? heroRes.value : {};
    _uiTr   = uiRes.status   === 'fulfilled' ? uiRes.value   : {};
  });
  return _loading;
}

// English fallback values (hardcoded — no fetch needed)
const UI_EN = {
  tab_heroes:           'Heroes',
  tab_effects:          'Effects',
  tab_support:          '♥',
  search_heroes:        'Search heroes...',
  search_effects:       'Search effects...',
  back:                 '← Back',
  cooldown_prefix:      'CD:',
  feedback_placeholder: 'Bug report or feedback...',
  feedback_submit:      'Send',
  feedback_sending:     'Sending...',
  feedback_ok:          'Sent!',
  feedback_error:       'Error. Try again.',
  support_title:        'Support the Author',
  error_loading:        'Error loading data:',
  obs_visible:          'Visible (sec):',
  obs_timer:            'Auto-dismiss in',
  obs_copied:           'Copied!',
  pin_label:            'Pin',
  dismiss_label:        'Dismiss',
  effect_heal:             'Continuous Heal',
  effect_freeze:           'Freeze',
  effect_sleep:            'Sleep',
  effect_stun:             'Stun',
  effect_provoke:          'Provoke',
  effect_fear:             'Fear',
  effect_true_fear:        'True Fear',
  effect_weaken:           'Weaken',
  effect_poison:           'Poison',
  effect_hp_burn:          'HP Burn',
  effect_burn:             'Burn',
  effect_hex:              'Hex',
  effect_bomb:             'Bomb',
  effect_time_bomb:        'Time Bomb',
  effect_leech:            'Leech',
  effect_decrease_def:     'Decrease DEF',
  effect_decrease_atk:     'Decrease ATK',
  effect_decrease_spd:     'Decrease SPD',
  effect_decrease_cr:      'Decrease C. Rate',
  effect_decrease_acc:     'Decrease ACC',
  effect_increase_def:     'Increase DEF',
  effect_increase_atk:     'Increase ATK',
  effect_speed_buff:       'Increase SPD',
  effect_increase_cr:      'Increase C. Rate',
  effect_increase_cd:      'Increase C. DMG',
  effect_increase_acc:     'Increase ACC',
  effect_shield:           'Shield',
  effect_veil:             'Veil',
  effect_unkillable:       'Unkillable',
  effect_ally_protect:     'Ally Protect',
  effect_counterattack:    'Counterattack',
  effect_reflect_damage:   'Reflect Damage',
  effect_block_buffs:      'Block Buffs',
  effect_block_debuffs:    'Block Debuffs',
  effect_block_damage:     'Block Damage',
  effect_block_revive:     'Block Revive',
  effect_necrosis:         'Necrosis',
  effect_perfect_veil:     'Perfect Veil',
  effect_decrease_max_hp:  'Decrease MAX HP',
  effect_sheep:            'Sheep',
  effect_strengthen:       'Strengthen',
  effect_increase_res:     'Increase RES',
  effect_decrease_res:     'Decrease RES',
  effect_revive:           'Revive',
  effect_turn_meter_boost:    'Turn Meter Boost',
  effect_turn_meter_decrease: 'Turn Meter Decrease',
  effect_extend_buffs:     'Extend Buffs',
  effect_remove_buffs:     'Remove Buffs',
  effect_remove_debuffs:   'Remove Debuffs',
  effect_steal_buffs:      'Steal Buffs',
  effect_nuke:             'Nuke',
};

export function t(key) {
  if (getLang() === 'uk' && _uiTr?.[key]) return _uiTr[key];
  return UI_EN[key] ?? key;
}

// Returns effect label for slug — translated string or null (caller uses slugToLabel fallback)
export function effectLabel(slug) {
  const key = `effect_${slug}`;
  if (getLang() === 'uk' && _uiTr?.[key]) return _uiTr[key];
  return UI_EN[key] ?? null;
}

// Returns copy of hero with translated name + skills (or original if no translation exists)
export function translateHero(hero) {
  if (getLang() === 'en') return hero;
  const tr = _heroTr?.[hero.id];
  if (!tr) return hero;
  return {
    ...hero,
    name: tr.name ?? hero.name,
    skills: (hero.skills ?? []).map((s, i) => ({
      ...s,
      name:        tr.skills?.[i]?.name        ?? s.name,
      description: tr.skills?.[i]?.description ?? s.description,
    })),
  };
}

// Apply active lang class to all .lang-btn elements in document
export function updateLangButtons() {
  const lang = getLang();
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('lang-btn--active', btn.dataset.lang === lang);
  });
}
