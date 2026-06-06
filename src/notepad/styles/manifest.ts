// src/notepad/styles/manifest.ts  (TEMPORARY STUB — overwritten by build:styles)
export type StyleCategory =
  | 'highlight' | 'shape' | 'arrow' | 'bubble' | 'squiggle' | 'line';
export interface StyleAsset {
  id: string;
  category: StyleCategory;
  thumbUrl: string;
  displayUrl: string;
  aspectRatio: number;
}
export const STYLE_ASSETS: StyleAsset[] = [];
export const ASSETS_BY_CATEGORY = {} as Record<StyleCategory, StyleAsset[]>;
export function getStyleAsset(_id: string): StyleAsset | undefined { return undefined; }
