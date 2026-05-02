import { useContext } from 'react';
import { NotepadContext } from './NotepadProvider';
import type { NotepadContextValue } from './NotepadProvider';

export function useNotepad(): NotepadContextValue {
  const ctx = useContext(NotepadContext);
  if (!ctx) throw new Error('useNotepad must be used within a NotepadProvider');
  return ctx;
}
