import type { StyleAsset, StyleCategory } from './manifest';

export function findAsset(
  assets: StyleAsset[],
  id: string,
): StyleAsset | undefined {
  return assets.find((a) => a.id === id);
}

export function filterAssets(
  assets: StyleAsset[],
  category: StyleCategory | 'all',
  query: string,
): StyleAsset[] {
  const q = query.trim().toLowerCase();
  return assets.filter(
    (a) =>
      (category === 'all' || a.category === category) &&
      (q === '' || a.id.toLowerCase().includes(q)),
  );
}
