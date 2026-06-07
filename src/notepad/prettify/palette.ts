// src/notepad/prettify/palette.ts
import type { HighlightRole, DecorationKind } from './prettify-types';

export const ROLE_SWATCH: Record<HighlightRole, string> = {
  'key-point': 'highlight-01',
  topic: 'highlight-02',
  theme: 'highlight-03',
};

export const KIND_ASSET: Record<DecorationKind, string> = {
  underline: 'squiggle-01',
  bracket: 'shape-01',
  'margin-arrow': 'arrow-01',
};

export const CONNECTOR_ASSET = 'line-01';
