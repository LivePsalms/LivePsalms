// src/notepad/prettify/apply-prettify.ts
import type { Editor } from '@tiptap/core';
import type { NoteDecoration } from '../types';
import type { PrettifyPlan } from './prettify-types';
import { locateQuote, type QuoteLocation } from './quote-locator';
import { ROLE_SWATCH, KIND_ASSET, CONNECTOR_ASSET } from './palette';
import { decorationPlacement, connectorPlacement, type Rect } from './anchor-geometry';

type NewDecoration = Omit<NoteDecoration, 'id' | 'z'>;

export interface ApplyDeps {
  editor: Editor;
  measure: (range: QuoteLocation) => Rect | null;
  contentWidth: number;
  addMany: (inits: NewDecoration[]) => void;
}

export interface ApplyResult {
  summary: string;
  highlights: number;
  decorations: number;
  connections: number;
}

export function applyPrettify(plan: PrettifyPlan, deps: ApplyDeps): ApplyResult {
  const { editor, measure, contentWidth, addMany } = deps;
  const { state, view } = editor;
  const mark = state.schema.marks.styleHighlight;

  let tr = state.tr;
  let highlights = 0;
  for (const h of plan.highlights) {
    const loc = locateQuote(state.doc, h.quote, h.occurrence);
    if (!loc) continue;
    tr = tr.addMark(loc.from, loc.to, mark.create({ swatchId: ROLE_SWATCH[h.role] }));
    highlights += 1;
  }
  if (highlights > 0) view.dispatch(tr);

  const inits: NewDecoration[] = [];
  let decorations = 0;
  for (const d of plan.decorations) {
    const loc = locateQuote(state.doc, d.quote, d.occurrence);
    if (!loc) continue;
    const rect = measure(loc);
    if (!rect) continue;
    inits.push({ assetId: KIND_ASSET[d.kind], ...decorationPlacement(d.kind, rect, contentWidth) });
    decorations += 1;
  }

  let connections = 0;
  for (const c of plan.connections) {
    const fromLoc = locateQuote(state.doc, c.from_quote, c.from_occurrence);
    const toLoc = locateQuote(state.doc, c.to_quote, c.to_occurrence);
    if (!fromLoc || !toLoc) continue;
    const a = measure(fromLoc);
    const b = measure(toLoc);
    if (!a || !b) continue;
    inits.push({ assetId: CONNECTOR_ASSET, behindText: true, ...connectorPlacement(a, b, contentWidth) });
    connections += 1;
  }

  if (inits.length > 0) addMany(inits);

  return { summary: plan.summary, highlights, decorations, connections };
}
