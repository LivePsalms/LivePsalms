import { useConnectionCards } from '../../../../notepad/hooks/useConnectionCards';
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
 * Drives the bottom-bar Lamplight glow-dot. Safe no-op when adapter/user absent.
 */
export function useHasConnections({
  adapter,
  userId,
  activeNote,
  totalNoteCount,
  loadNeighborNotes,
}: UseHasConnectionsArgs): boolean {
  // useConnectionCards requires a non-null adapter; when absent, pass a null
  // activeNote so the hook parks in its inactive phase and never fetches.
  const { state } = useConnectionCards({
    adapter: (adapter ?? ({} as LamplightAdapter)),
    userId: userId ?? '',
    activeNote: adapter && userId ? activeNote : null,
    totalNoteCount,
    loadNeighborNotes,
  });
  return state.phase === 'ready' && state.cards.length > 0;
}
