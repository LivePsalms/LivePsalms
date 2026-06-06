export const IN_SCOPE_CATEGORIES = [
  'highlight', 'shape', 'arrow', 'bubble', 'squiggle', 'line',
];

// Map a source-folder path (relative to the Notes Styles root, forward-slashed)
// to a StyleCategory, or null if the folder is out of scope.
export function categorize(folderPath) {
  const p = folderPath.replace(/\/+$/, '').trim();
  if (p.startsWith('1. Large Shapes')) return 'shape';
  if (p.startsWith('2. Highlights & Boxes')) return 'highlight';
  if (p.startsWith('3. Squiggles & Lines/Squiggles')) return 'squiggle';
  if (p.startsWith('3. Squiggles & Lines/Lines & Dividers')) return 'line';
  if (p.startsWith('4. Arrows')) return 'arrow';
  if (p.startsWith('5. Speech Bubbles')) return 'bubble';
  return null;
}

// Build a filesystem-safe, unique id from a filename (and optional category prefix).
export function slugify(filename, category) {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return category ? `${category}-${base}` : base;
}
