import { slugToLabel } from './utils.js';

export async function loadHeroes(jsonPath = '../data/heroes.json') {
  const response = await fetch(jsonPath);
  if (!response.ok) throw new Error(`Failed to load heroes: ${response.status}`);
  return response.json();
}

export function buildEffectsIndex(heroes) {
  /** @type {Record<string, Array<{hero: object, skill: object}>>} */
  const index = {};
  for (const hero of heroes) {
    for (const skill of hero.skills) {
      for (const slug of skill.effects) {
        if (!index[slug]) index[slug] = [];
        index[slug].push({ hero, skill });
      }
    }
  }
  return index;
}

export function buildEffectsList(effectsIndex) {
  return Object.keys(effectsIndex)
    .map(slug => ({ slug, label: slugToLabel(slug) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function filterHeroesByName(heroes, query) {
  if (!query?.trim()) return heroes;
  const q = query.trim().toLowerCase();
  return heroes.filter(h => h.name.toLowerCase().includes(q));
}

export function filterEffects(effectsList, query) {
  if (!query?.trim()) return effectsList;
  const q = query.trim().toLowerCase();
  return effectsList.filter(e => e.label.toLowerCase().includes(q));
}
