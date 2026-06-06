// src/notepad/decorations/DecorationLayer.tsx
import { useRef, useEffect, useState } from 'react';
import { DecorationItem } from './DecorationItem';
import type { NoteDecoration } from '../types';

interface Props {
  decorations: NoteDecoration[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onChange: (next: NoteDecoration) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
}

export function DecorationLayer({
  decorations, selectedId, onSelect, onDeselect,
  onChange, onDelete, onDuplicate, onBringToFront, onSendToBack,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(1);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setContentWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-testid="decoration-canvas"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onDeselect(); }}
      // No zIndex here: each DecorationItem sets its own zIndex so it can sit
      // above OR below the editor text within the shared (isolated) stacking
      // context established by the content wrapper in Editor.tsx.
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
        {decorations.map((d) => (
          <div key={d.id} style={{ pointerEvents: 'auto' }}>
            <DecorationItem
              decoration={d}
              selected={selectedId === d.id}
              contentWidth={contentWidth}
              onChange={onChange}
              onSelect={onSelect}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onBringToFront={onBringToFront}
              onSendToBack={onSendToBack}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
