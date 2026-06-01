export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugToLabel(slug) {
  return slug.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
