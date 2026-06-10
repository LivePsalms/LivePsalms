import { useState } from 'react';
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

/** Persisted across sessions; a single global preference, not per-note. */
const CONNECTION_CARDS_OPEN_KEY = 'lp.notepad.connectionCards.open';

/** Default closed: only an explicit stored 'true' opens. Safe if storage throws. */
function readInitialOpen(): boolean {
  try {
    return localStorage.getItem(CONNECTION_CARDS_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Inline strip for the desktop Content tab. Self-hides for every state
 * except `ready` — no empty-state placeholders in the writing surface.
 * Owns the desktop show/hide preference and renders a collapsible header.
 * (Empty states and the always-on stack live on mobile via
 * ConnectionCardsPanel directly.)
 */
export function ConnectionCardsStrip(props: ConnectionCardsStripProps) {
  const [open, setOpen] = useState<boolean>(readInitialOpen);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CONNECTION_CARDS_OPEN_KEY, String(next));
      } catch {
        // Best-effort persistence; ignore storage failures.
      }
      return next;
    });
  };

  return (
    <ConnectionCardsPanel
      {...props}
      showEmptyStates={false}
      collapsible
      open={open}
      onToggleOpen={toggle}
    />
  );
}
