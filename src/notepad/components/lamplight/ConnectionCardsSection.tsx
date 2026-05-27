import { ConnectionCard } from './ConnectionCard';
import type { ConnectionCard as ConnectionCardData } from '../../hooks/useConnectionCards';

export interface ConnectionCardsSectionProps {
  cards: ConnectionCardData[];
  onExpand: (relatedNoteId: string) => void;
  onRetry: (relatedNoteId: string) => void;
  onOpenNote: (relatedNoteId: string) => void;
}

export function ConnectionCardsSection({
  cards,
  onExpand,
  onRetry,
  onOpenNote,
}: ConnectionCardsSectionProps) {
  return (
    <div className="px-4 py-4" style={{ background: 'var(--alabaster)' }}>
      <h3
        className="text-xs uppercase tracking-wide mb-3"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Connections
      </h3>
      {cards.map((c) => (
        <ConnectionCard
          key={c.relatedNoteId}
          card={c}
          onExpand={onExpand}
          onRetry={onRetry}
          onOpenNote={onOpenNote}
        />
      ))}
    </div>
  );
}
