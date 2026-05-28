import { useState } from 'react';
import { useConnectionCards } from '../../hooks/useConnectionCards';
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

export function ConnectionCardsStrip({
  adapter,
  userId,
  activeNote,
  totalNoteCount,
  loadNeighborNotes,
  onOpenNote,
}: ConnectionCardsStripProps) {
  const { state, expandCard, retryWhy } = useConnectionCards({
    adapter,
    userId,
    activeNote,
    totalNoteCount,
    loadNeighborNotes,
  });
  const [activeChipId, setActiveChipId] = useState<string | null>(null);

  // The strip is invisible for every state except 'ready' — no empty states,
  // no transient placeholders. The Lamplight tab handles those for users who
  // go looking; the strip is opt-in visibility in the writing surface.
  if (state.phase !== 'ready') return null;

  const cards = state.cards;
  const activeCard = activeChipId ? cards.find((c) => c.relatedNoteId === activeChipId) ?? null : null;

  const handleChipClick = async (relatedNoteId: string) => {
    if (activeChipId === relatedNoteId) {
      setActiveChipId(null);
      return;
    }
    setActiveChipId(relatedNoteId);
    const card = cards.find((c) => c.relatedNoteId === relatedNoteId);
    if (card && card.why.phase === 'collapsed') {
      await expandCard(relatedNoteId);
    }
  };

  return (
    <section
      aria-label="Connection cards"
      className="border-t px-4 py-3"
      style={{ borderColor: 'var(--pale-stone)', background: 'var(--plaster)' }}
    >
      {activeCard && (
        <div
          className="mb-2 border rounded px-3 py-2"
          style={{ borderColor: 'var(--pale-stone)', background: 'var(--alabaster)' }}
        >
          {activeCard.why.phase === 'loading' && (
            <p
              role="status"
              aria-live="polite"
              className="text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              Lighting…
            </p>
          )}
          {activeCard.why.phase === 'shown' && (
            <p
              className="text-sm italic"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
              data-cached={activeCard.why.cached}
            >
              {activeCard.why.text}
            </p>
          )}
          {activeCard.why.phase === 'error' && (
            <div
              className="text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              <p className="mb-1">Couldn't read this connection.</p>
              <button
                onClick={() => retryWhy(activeCard.relatedNoteId)}
                className="underline cursor-pointer"
                style={{ color: 'var(--deep-umber)' }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
      <p
        className="text-[10px] uppercase tracking-wider mb-2"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Connection Cards
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1" role="list">
        {cards.map((c) => {
          const signals = [...c.sharedTags.map((t) => `#${t}`), ...c.sharedVerseRefs];
          const isActive = activeChipId === c.relatedNoteId;
          return (
            <div
              key={c.relatedNoteId}
              role="listitem"
              className="flex-none w-[220px] border rounded"
              style={{
                borderColor: isActive ? 'var(--deep-umber)' : 'var(--pale-stone)',
                background: 'var(--alabaster)',
              }}
            >
              <button
                aria-label={`Show why this connects to ${c.relatedNoteTitle}`}
                aria-pressed={isActive}
                onClick={() => handleChipClick(c.relatedNoteId)}
                className="block w-full text-left px-3 py-2 cursor-pointer"
              >
                {signals.length > 0 && (
                  <p
                    className="text-[10px] mb-1 truncate"
                    style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {signals.join(' · ')}
                  </p>
                )}
                <p
                  className="text-xs truncate"
                  style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                >
                  {c.relatedNoteTitle}
                </p>
              </button>
              <button
                aria-label={`Open note: ${c.relatedNoteTitle}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNote(c.relatedNoteId);
                }}
                className="block w-full text-right px-3 pb-1 text-xs cursor-pointer hover:underline"
                style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
              >
                Open ↗
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
