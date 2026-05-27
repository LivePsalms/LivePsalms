import type { ConnectionCard as ConnectionCardData } from '../../hooks/useConnectionCards';

export interface ConnectionCardProps {
  card: ConnectionCardData;
  onExpand: (relatedNoteId: string) => void;
  onRetry: (relatedNoteId: string) => void;
  onOpenNote: (relatedNoteId: string) => void;
}

export function ConnectionCard({
  card,
  onExpand,
  onRetry,
  onOpenNote,
}: ConnectionCardProps) {
  const isExpanded =
    card.why.phase === 'loading' ||
    card.why.phase === 'shown' ||
    card.why.phase === 'error';

  return (
    <div
      className="border rounded mb-2"
      style={{ borderColor: 'var(--pale-stone)', background: 'var(--alabaster)' }}
    >
      <div className="flex items-center px-3 py-2 gap-2">
        <button
          aria-label={isExpanded ? 'Collapse card' : 'Expand card'}
          aria-expanded={isExpanded}
          onClick={() => onExpand(card.relatedNoteId)}
          className="text-sm cursor-pointer"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
        >
          <span aria-hidden>{isExpanded ? '▾' : '▸'}</span>
        </button>
        <button
          aria-label={`Open note: ${card.relatedNoteTitle}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenNote(card.relatedNoteId);
          }}
          className="text-sm hover:underline cursor-pointer flex-1 text-left"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
        >
          {card.relatedNoteTitle}
        </button>
      </div>
      {(card.sharedTags.length > 0 || card.sharedVerseRefs.length > 0) && (
        <div
          className="px-3 pb-2 text-xs flex flex-wrap gap-2"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          {card.sharedTags.map((t) => (
            <span key={`tag-${t}`}>#{t}</span>
          ))}
          {card.sharedVerseRefs.map((r) => (
            <span key={`ref-${r}`}>{r}</span>
          ))}
        </div>
      )}
      {isExpanded && (
        <div
          className="border-t px-3 py-2"
          style={{ borderColor: 'var(--pale-stone)' }}
        >
          {card.why.phase === 'loading' && (
            <p
              role="status"
              aria-live="polite"
              className="text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              Lighting…
            </p>
          )}
          {card.why.phase === 'shown' && (
            <p
              className="text-sm italic"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
              data-cached={card.why.cached}
            >
              {card.why.text}
            </p>
          )}
          {card.why.phase === 'error' && (
            <div
              className="text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              <p className="mb-1">Couldn't read this connection.</p>
              <button
                onClick={() => onRetry(card.relatedNoteId)}
                className="underline cursor-pointer"
                style={{ color: 'var(--deep-umber)' }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
