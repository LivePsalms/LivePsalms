// src/notepad/decorations/DecorationItem.tsx
import { useRef } from 'react';
import { getStyleAsset } from '../styles/manifest';
import { moveTo, resizeWidthPct, rotationDeg, pinchTransform } from './decoration-geometry';
import type { NoteDecoration } from '../types';

interface Props {
  decoration: NoteDecoration;
  selected: boolean;
  contentWidth: number;
  onChange: (next: NoteDecoration) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
}

type Gesture = { kind: 'move' | 'resize'; startX: number; startY: number; base: NoteDecoration };

export function DecorationItem({
  decoration: d, selected, contentWidth,
  onChange, onSelect, onDelete, onDuplicate, onBringToFront, onSendToBack,
}: Props) {
  const asset = getStyleAsset(d.assetId);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ startDist: number; startAngle: number; base: NoteDecoration } | null>(null);

  const twoPointerMetrics = () => {
    const pts = [...pointers.current.values()];
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return { dist: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    end(e);
  };

  if (!asset) return null;

  const start = (kind: Gesture['kind']) => (e: React.PointerEvent) => {
    e.stopPropagation();
    // Assign gesture state BEFORE touching pointer capture so a jsdom
    // limitation in setPointerCapture can never prevent the drag from starting.
    gesture.current = { kind, startX: e.clientX, startY: e.clientY, base: d };
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* jsdom may not implement pointer capture; harmless no-op */
    }
    if (kind === 'move') onSelect(d.id);
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dxPx = e.clientX - g.startX;
    const dyPx = e.clientY - g.startY;
    if (g.kind === 'move') {
      onChange(moveTo(g.base, { dxPx, dyPx, contentWidth }));
    } else {
      onChange(resizeWidthPct(g.base, { dxPx, contentWidth }));
    }
  };

  const end = (e: React.PointerEvent) => {
    try {
      if ((e.target as Element).hasPointerCapture?.(e.pointerId)) {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      }
    } catch {
      /* jsdom may not implement pointer capture; harmless no-op */
    }
    gesture.current = null;
  };

  const rotate = (e: React.PointerEvent) => {
    e.stopPropagation();
    onChange({ ...d, rotation: rotationDeg(d.rotation + 15) });
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${d.xPct * 100}%`,
        top: d.yPx,
        width: `${d.widthPct * 100}%`,
        transform: `rotate(${d.rotation}deg)`,
        transformOrigin: 'center center',
        zIndex: d.z,
        pointerEvents: 'auto',
        outline: selected ? '2px solid var(--deep-umber)' : 'none',
      }}
    >
      <div
        data-testid={`decoration-body-${d.id}`}
        onPointerDown={(e) => {
          e.stopPropagation();
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2) {
            const m = twoPointerMetrics();
            pinch.current = { startDist: m.dist, startAngle: m.angle, base: d };
            gesture.current = null;
          } else {
            gesture.current = { kind: 'move', startX: e.clientX, startY: e.clientY, base: d };
            onSelect(d.id);
          }
          try {
            (e.target as Element).setPointerCapture?.(e.pointerId);
          } catch {
            /* jsdom may not implement pointer capture; harmless no-op */
          }
        }}
        onPointerMove={(e) => {
          if (pointers.current.has(e.pointerId)) {
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          }
          if (pinch.current && pointers.current.size >= 2) {
            const m = twoPointerMetrics();
            onChange(pinchTransform(pinch.current.base, {
              startDist: pinch.current.startDist, dist: m.dist,
              startAngle: pinch.current.startAngle, angle: m.angle,
            }));
            return;
          }
          move(e);
        }}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        style={{ cursor: 'move', touchAction: 'none' }}
      >
        <img src={asset.displayUrl} alt="" draggable={false}
          style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }} />
      </div>

      {selected && (
        <>
          {/* Relies on pointer capture (set in `start`) to keep receiving moves once the pointer leaves the 12px handle; no-op in jsdom. */}
          <div
            aria-label="Resize decoration"
            onPointerDown={start('resize')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            style={handleStyle('-6px', '-6px', 'nwse-resize', 'bottom-right')}
          />
          <div
            aria-label="Rotate decoration"
            onPointerDown={rotate}
            style={handleStyle('-22px', 'calc(50% - 6px)', 'grab', 'top')}
          />
          <div style={{
            position: 'absolute', top: -34, left: 0, display: 'flex', gap: 4,
            background: '#fff', border: '1px solid var(--pale-stone)', borderRadius: 6,
            padding: '2px 4px', boxShadow: '0 2px 8px rgba(0,0,0,.14)',
          }}>
            <button aria-label="Bring to front" onClick={() => onBringToFront(d.id)} style={barBtn}>⤒</button>
            <button aria-label="Send to back" onClick={() => onSendToBack(d.id)} style={barBtn}>⤓</button>
            <button aria-label="Duplicate decoration" onClick={() => onDuplicate(d.id)} style={barBtn}>⎘</button>
            <button aria-label="Delete decoration" onClick={() => onDelete(d.id)} style={barBtn}>✕</button>
          </div>
        </>
      )}
    </div>
  );
}

const barBtn: React.CSSProperties = {
  fontSize: 12, border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 3px', color: 'var(--charred)',
};

function handleStyle(
  top: string, right: string, cursor: string, kind: 'bottom-right' | 'top',
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute', width: 12, height: 12, borderRadius: '50%',
    background: '#fff', border: '2px solid var(--deep-umber)', cursor,
  };
  if (kind === 'bottom-right') return { ...base, bottom: top, right };
  return { ...base, top, left: right };
}
