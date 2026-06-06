// src/notepad/decorations/DecorationLayer.tsx
import { getStyleAsset } from '../styles/manifest';
import type { NoteDecoration } from '../types';

interface Props {
  decorations: NoteDecoration[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
}

export function DecorationLayer({ decorations, selectedId, onSelect, onDeselect }: Props) {
  return (
    <div
      data-testid="decoration-canvas"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDeselect();
      }}
      style={{
        position: 'absolute',
        inset: 0,
        // Let text under empty areas stay interactive; items re-enable pointers.
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {decorations.map((d) => {
        const asset = getStyleAsset(d.assetId);
        if (!asset) return null;
        return (
          <div
            key={d.id}
            data-testid={`decoration-${d.id}`}
            onMouseDown={(e) => { e.stopPropagation(); onSelect(d.id); }}
            style={{
              position: 'absolute',
              left: `${d.xPct * 100}%`,
              top: d.yPx,
              width: `${d.widthPct * 100}%`,
              transform: `rotate(${d.rotation}deg)`,
              transformOrigin: 'center center',
              zIndex: d.z,
              pointerEvents: 'auto',
              cursor: 'move',
              outline: selectedId === d.id ? '2px solid var(--deep-umber)' : 'none',
            }}
          >
            <img
              src={asset.displayUrl}
              alt=""
              draggable={false}
              style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
            />
          </div>
        );
      })}
    </div>
  );
}
