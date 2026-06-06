// src/notepad/decorations/useDecorations.ts
import { useEffect, useState, useCallback } from 'react';
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
) {
  const [decorations, setDecorations] = useState<NoteDecoration[]>(
    activeNote?.decorations ?? [],
  );

  // Reload when the active note changes (by id).
  useEffect(() => {
    setDecorations(activeNote?.decorations ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.id]);

  const commit = useCallback(
    (next: NoteDecoration[]) => {
      setDecorations(next);
      if (activeNote) updateNote(activeNote.id, { decorations: next });
    },
    [activeNote, updateNote],
  );

  return {
    decorations,
    add: (init: NewDecoration) => commit(addDecoration(decorations, init, uuidv4)),
    update: (id: string, patch: Partial<Omit<NoteDecoration, 'id'>>) =>
      commit(updateDecoration(decorations, id, patch)),
    remove: (id: string) => commit(removeDecoration(decorations, id)),
    duplicate: (id: string) => commit(duplicateDecoration(decorations, id, uuidv4)),
    bringToFront: (id: string) => commit(bringToFront(decorations, id)),
    sendToBack: (id: string) => commit(sendToBack(decorations, id)),
  };
}
