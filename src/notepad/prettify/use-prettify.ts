// src/notepad/prettify/use-prettify.ts
import { useCallback, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { NoteDecoration } from '../types';
import type { PrettifyDensity, PrettifyReason, PrettifyResult } from './prettify-types';
import { applyPrettify, type ApplyResult } from './apply-prettify';
import type { Rect } from './anchor-geometry';
import type { QuoteLocation } from './quote-locator';

type NewDecoration = Omit<NoteDecoration, 'id' | 'z'>;

export interface PrettifyCapableAdapter {
  generatePrettifyPlan(
    userId: string,
    noteId: string,
    contentText: string,
    density: PrettifyDensity,
  ): Promise<PrettifyResult>;
}

export interface UsePrettifyDeps {
  editor: Editor | null;
  adapter: PrettifyCapableAdapter | null;
  userId: string | null;
  noteId: string | null;
  contentText: string;
  measure: (range: QuoteLocation) => Rect | null;
  contentWidth: number;
  decorations: NoteDecoration[];
  addMany: (inits: NewDecoration[]) => void;
  reset: (list: NoteDecoration[]) => void;
  applyFn?: typeof applyPrettify;
}

export interface PrettifyState {
  phase: 'idle' | 'running' | 'done' | 'error';
  result?: ApplyResult;
  reason?: PrettifyReason;
  canUndo: boolean;
}

interface Snapshot {
  json: ReturnType<Editor['getJSON']>;
  decorations: NoteDecoration[];
}

export function usePrettify(deps: UsePrettifyDeps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const snapshotRef = useRef<Snapshot | null>(null);
  const [state, setState] = useState<PrettifyState>({ phase: 'idle', canUndo: false });

  const run = useCallback(async (density: PrettifyDensity) => {
    const d = depsRef.current;
    if (!d.editor || !d.adapter || !d.userId || !d.noteId) return;
    setState({ phase: 'running', canUndo: false });
    const snapshot: Snapshot = { json: d.editor.getJSON(), decorations: [...d.decorations] };
    const result = await d.adapter.generatePrettifyPlan(d.userId, d.noteId, d.contentText, density);
    if (!result.ok) {
      setState({ phase: 'error', reason: result.reason, canUndo: false });
      return;
    }
    snapshotRef.current = snapshot;
    const apply = d.applyFn ?? applyPrettify;
    const applied = apply(result.plan, {
      editor: d.editor,
      measure: d.measure,
      contentWidth: d.contentWidth,
      addMany: d.addMany,
    });
    setState({ phase: 'done', result: applied, canUndo: true });
  }, []);

  const undo = useCallback(() => {
    const d = depsRef.current;
    const snap = snapshotRef.current;
    if (!snap || !d.editor) return;
    d.editor.commands.setContent(snap.json);
    d.reset(snap.decorations);
    snapshotRef.current = null;
    setState({ phase: 'idle', canUndo: false });
  }, []);

  const dismiss = useCallback(() => {
    setState((s) => ({ phase: 'idle', canUndo: s.canUndo }));
  }, []);

  return { state, run, undo, dismiss };
}
