import { useConnectionDiscovery } from '../../../../notepad/hooks/useConnectionDiscovery';
import type { LamplightAdapter } from '../../../../notepad/storage/lamplight-adapter';
import type { Note } from '../../../../notepad/types';

export interface UseHasConnectionsArgs {
  adapter: LamplightAdapter | null;
  userId: string | null;
  activeNote: Note | null;
  totalNoteCount: number;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
}

/**
 * True when the active note has at least one qualifying Lamplight connection.
 * Drives the bottom-bar Lamplight glow-dot. Runs the cheap 'presence' discovery
 * mode, which stops at the neighbor count and never loads neighbor notes.
 * Safe no-op when adapter/user absent: useConnectionDiscovery parks inactive on
 * a null adapter.
 */
export function useHasConnections({
  adapter,
  activeNote,
  totalNoteCount,
  loadNeighborNotes,
}: UseHasConnectionsArgs): boolean {
  const { state } = useConnectionDiscovery({
    adapter,
    activeNote,
    totalNoteCount,
    loadNeighborNotes,
    mode: 'presence',
  });
  return state.phase === 'present';
}
