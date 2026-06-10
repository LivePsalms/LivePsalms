import { useEffect, useState } from 'react';
import { useConnectionDiscovery } from '../../hooks/useConnectionDiscovery';
import { useConnectionWhy } from '../../hooks/useConnectionWhy';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { firstNameOf } from '../../first-load/notepad-first-load';
import { sanitizeFirstName } from '../../utils/personalization';
import { prefixWhyWithName } from '../../connection-cards/why-render';
import { ConnectionCardsEmpty } from './ConnectionCardsEmpty';
import type { LamplightAdapter } from '../../storage/lamplight-adapter';
import type { Note } from '../../types';

export interface ConnectionCardsPanelProps {
  adapter: LamplightAdapter;
  userId: string;
  activeNote: Note | null;
  totalNoteCount: number;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
  onOpenNote: (noteId: string) => void;
  /** When true, non-ready phases render a contextual empty state instead of nothing. */
  showEmptyStates?: boolean;
  /** 'strip' = horizontal inline strip (desktop). 'stack' = vertical full-width cards (mobile). */
  layout?: 'strip' | 'stack';
  /** When true, the label row becomes a clickable header that shows/hides the card list (desktop strip). */
  collapsible?: boolean;
  /** Whether the card list is shown. Only meaningful when `collapsible`. Default true. */
  open?: boolean;
  /** Toggle handler invoked when the collapsible header is clicked. */
  onToggleOpen?: () => void;
}

export function ConnectionCardsPanel({
  adapter,
  activeNote,
  totalNoteCount,
  loadNeighborNotes,
  onOpenNote,
  showEmptyStates = false,
  layout = 'strip',
  collapsible = false,
  open = true,
  onToggleOpen,
}: ConnectionCardsPanelProps) {
  // Pull the server-authoritative similarity threshold so the panel never
  // renders a card the edge function will refuse to explain. While the fetch
  // is in flight (or if it errors), the hook falls back to the spec value
  // (0.78), which is the production-safe default.
  const [minSimilarity, setMinSimilarity] = useState<number | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    adapter
      .getConnectionCardThresholds()
      .then((t) => {
        if (!cancelled) setMinSimilarity(t.minSimilarity);
      })
      .catch(() => {
        // Swallow — hook default (0.78) is the right fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  const { state, retry } = useConnectionDiscovery({
    adapter,
    activeNote,
    totalNoteCount,
    loadNeighborNotes,
    mode: 'full',
    qualifyingMinSimilarity: minSimilarity,
  });
  const { whyState, expand, retry: retryWhy } = useConnectionWhy({
    adapter,
    sourceNoteId: activeNote?.id ?? null,
  });
  const { user } = useAuthSession();
  const firstName = user ? sanitizeFirstName(firstNameOf(user)) : null;
  const [activeChipId, setActiveChipId] = useState<string | null>(null);

  if (state.phase !== 'ready') {
    // 'present' is a presence-mode-only phase; full mode never emits it.
    if (state.phase === 'present') return null;
    if (showEmptyStates) {
      return <ConnectionCardsEmpty state={state} onRetry={retry} />;
    }
    return null;
  }

  const cards = state.cards;
  const activeCard = activeChipId
    ? cards.find((c) => c.relatedNoteId === activeChipId) ?? null
    : null;

  const handleChipClick = async (relatedNoteId: string) => {
    if (activeChipId === relatedNoteId) {
      setActiveChipId(null);
      return;
    }
    setActiveChipId(relatedNoteId);
    if (whyState(relatedNoteId).phase === 'collapsed') {
      await expand(relatedNoteId);
    }
  };

  const isStack = layout === 'stack';
  // When not collapsible the list is always shown (mobile/stack and any other
  // caller keep today's behavior). When collapsible, `open` drives visibility.
  const showList = !collapsible || open;

  const renderWhy = (card: typeof cards[number]) => {
    const why = whyState(card.relatedNoteId);
    if (why.phase === 'loading') {
      return (
        <p
          role="status"
          aria-live="polite"
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Lighting…
        </p>
      );
    }
    if (why.phase === 'shown') {
      return (
        <p
          className="text-sm italic"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Cormorant Garamond, serif' }}
          data-cached={why.cached}
        >
          {prefixWhyWithName(why.text, firstName)}
        </p>
      );
    }
    if (why.phase === 'error') {
      return (
        <div className="text-xs" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          <p className="mb-1">Couldn't read this connection.</p>
          <button
            onClick={() => retryWhy(card.relatedNoteId)}
            className="underline cursor-pointer"
            style={{ color: 'var(--deep-umber)' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <section
      aria-label="Connection cards"
      className="border-t px-4 py-3"
      style={{ borderColor: 'var(--pale-stone)', background: 'var(--plaster)' }}
    >
      {!isStack && showList && activeCard && (
        <div
          className="mb-2 border rounded px-3 py-2"
          style={{ borderColor: 'var(--pale-stone)', background: 'var(--alabaster)' }}
        >
          {renderWhy(activeCard)}
        </div>
      )}
      {collapsible ? (
        <button
          type="button"
          onClick={() => onToggleOpen?.()}
          aria-expanded={open}
          aria-controls={open ? 'connection-cards-list' : undefined}
          className="flex items-center gap-1 text-[10px] uppercase tracking-wider mb-2 cursor-pointer"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Connection Cards
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              transition: 'transform 0.2s',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          >
            ⌄
          </span>
        </button>
      ) : (
        <p
          className="text-[10px] uppercase tracking-wider mb-2"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Connection Cards
        </p>
      )}
      {showList && (
      <div
        id="connection-cards-list"
        className={isStack ? 'flex flex-col gap-2' : 'flex gap-2 overflow-x-auto pb-1'}
        role="list"
      >
        {cards.map((c) => {
          const signals = [...c.sharedTags.map((t) => `#${t}`), ...c.sharedVerseRefs];
          const isActive = activeChipId === c.relatedNoteId;
          return (
            <div
              key={c.relatedNoteId}
              role="listitem"
              className={`${isStack ? 'w-full' : 'flex-none w-[220px]'} border rounded`}
              style={{
                borderColor: isActive ? 'var(--deep-umber)' : 'var(--pale-stone)',
                background: 'var(--alabaster)',
              }}
            >
              <button
                aria-label={`Show why this connects to ${c.relatedNoteTitle}`}
                aria-expanded={isActive}
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
                  className={isStack ? 'text-base' : 'text-xs truncate'}
                  style={{
                    color: 'var(--deep-umber)',
                    fontFamily: isStack ? 'Cormorant Garamond, serif' : 'Outfit, sans-serif',
                  }}
                >
                  {c.relatedNoteTitle}
                </p>
              </button>
              {isStack && isActive && (
                <div className="px-3 pb-2">{renderWhy(c)}</div>
              )}
              {isStack ? (
                <div
                  className="flex items-center justify-between border-t px-3 pt-2 pb-2 mt-1"
                  style={{ borderColor: 'var(--pale-stone)' }}
                >
                  <button
                    aria-expanded={isActive}
                    onClick={() => handleChipClick(c.relatedNoteId)}
                    className="inline-flex items-center gap-1 text-xs cursor-pointer"
                    style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {isActive ? 'Hide' : 'Why these connect'}
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        transition: 'transform 0.2s',
                        transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      ⌄
                    </span>
                  </button>
                  <button
                    aria-label={`Open note: ${c.relatedNoteTitle}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNote(c.relatedNoteId);
                    }}
                    className="text-xs cursor-pointer hover:underline"
                    style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                  >
                    Open ↗
                  </button>
                </div>
              ) : (
                <button
                  aria-label={`Open note: ${c.relatedNoteTitle}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNote(c.relatedNoteId);
                  }}
                  className="block w-full text-right px-3 text-xs cursor-pointer hover:underline pb-1"
                  style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                >
                  Open ↗
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}
