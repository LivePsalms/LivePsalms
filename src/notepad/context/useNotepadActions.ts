import { createContext, useContext } from 'react';
import type { NotepadActions } from '../collection';

export const NotepadActionsContext = createContext<NotepadActions | null>(null);

export function useNotepadActions(): NotepadActions {
  const actions = useContext(NotepadActionsContext);
  if (!actions) throw new Error('useNotepadActions must be used within a NotepadProvider');
  return actions;
}
