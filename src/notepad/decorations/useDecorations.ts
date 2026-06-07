// src/notepad/decorations/useDecorations.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Note, NoteDecoration } from '../types';
import {
  addDecoration, updateDecoration, removeDecoration,
  duplicateDecoration, bringToFront, sendToBack,
} from './decoration-ops';

type NewDecoration = Omit<NoteDecoration, 'id' | 'z'>;

export function useDecorations(
  activeNote: Note | null,
  updateNote: (id: string, updates: Partial<Pick<Note, 'decorations'>>) => unknown,
  saveDebounceMs = 500,
) {
  const [decorations, setDecorations] = useState<NoteDecoration[]>(
    activeNote?.decorations ?? [],
  );

  // Debounced-persistence machinery, mirroring use-note-editor.ts.
  // `pendingRef` holds the latest decorations array awaiting a write (or null
  // when nothing is pending). Refs are the reliable source of "latest" because
  // the React state setter is async — never read `decorations`/`next` from a
  // stale setTimeout closure.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<NoteDecoration[] | null>(null);
  // The note id a pending write belongs to, captured at schedule time so a
  // flush during a note switch lands on the ORIGINAL note, not the new one.
  const pendingNoteIdRef = useRef<string | null>(null);
  // Stable ref to updateNote so flush/cleanup never see a stale callback.
  const updateNoteRef = useRef(updateNote);
  updateNoteRef.current = updateNote;

  // Persist the pending state (if any) immediately and clear the timer.
  const flush = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingRef.current;
    const noteId = pendingNoteIdRef.current;
    if (pending !== null && noteId !== null) {
      pendingRef.current = null;
      pendingNoteIdRef.current = null;
      updateNoteRef.current(noteId, { decorations: pending });
    }
  }, []);

  // Reload when the active note changes (by id). Flush any pending write to the
  // ORIGINAL note first so the last position/rotation/size is never lost.
  useEffect(() => {
    flush();
    setDecorations(activeNote?.decorations ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.id]);

  // Flush on unmount so an in-flight gesture's final state is persisted.
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  const commit = useCallback(
    (next: NoteDecoration[]) => {
      // Keep the overlay visually responsive on every call/frame.
      setDecorations(next);
      if (!activeNote) return;
      // Stage the latest state and (re)schedule a single coalesced write.
      pendingRef.current = next;
      pendingNoteIdRef.current = activeNote.id;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(flush, saveDebounceMs);
    },
    [activeNote, saveDebounceMs, flush],
  );

  return {
    decorations,
    add: (init: NewDecoration) => commit(addDecoration(decorations, init, uuidv4)),
    addMany: (inits: NewDecoration[]) =>
      commit(inits.reduce((acc, init) => addDecoration(acc, init, uuidv4), decorations)),
    reset: (list: NoteDecoration[]) => commit(list),
    update: (id: string, patch: Partial<Omit<NoteDecoration, 'id'>>) =>
      commit(updateDecoration(decorations, id, patch)),
    remove: (id: string) => commit(removeDecoration(decorations, id)),
    duplicate: (id: string) => commit(duplicateDecoration(decorations, id, uuidv4)),
    bringToFront: (id: string) => commit(bringToFront(decorations, id)),
    sendToBack: (id: string) => commit(sendToBack(decorations, id)),
  };
}
