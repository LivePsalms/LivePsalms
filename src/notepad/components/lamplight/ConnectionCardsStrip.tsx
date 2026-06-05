import { ConnectionCardsPanel } from './ConnectionCardsPanel';
import type { LamplightAdapter } from '../../storage/lamplight-adapter';
import type { Note } from '../../types';

export interface ConnectionCardsStripProps {
  adapter: LamplightAdapter;
  userId: string;
  activeNote: Note | null;
  totalNoteCount: number;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
  onOpenNote: (noteId: string) => void;
}

/**
 * Inline strip for the desktop Content tab. Self-hides for every state
 * except `ready` — no empty-state placeholders in the writing surface.
 * (Empty states live in the mobile Connection Cards segment via
 * ConnectionCardsPanel with showEmptyStates.)
 */
export function ConnectionCardsStrip(props: ConnectionCardsStripProps) {
  return <ConnectionCardsPanel {...props} showEmptyStates={false} />;
}
