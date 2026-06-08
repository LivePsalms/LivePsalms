// src/notepad/decorations/DecorationLayer.tsx
import { useRef, useLayoutEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { DecorationItem } from './DecorationItem';
import { topmostBehindAtPoint } from './decoration-geometry';
import { getStyleAsset } from '../styles/manifest';
import type { NoteDecoration } from '../types';

export interface DecorationLayerHandle {
  // Hit-tests a viewport point against behind-text decorations, which sit below
  // the editor text and so never receive clicks directly. Returns the topmost
  // matching decoration id (or null). The editor calls this on alt/double-click
  // to make behind-text decorations selectable without stealing normal clicks.
  hitTestBehind(clientX: number, clientY: number): string | null;
}

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
  onFirstWidth?: (width: number) => void;
}

export const DecorationLayer = forwardRef<DecorationLayerHandle, Props>(function DecorationLayer({
  decorations, selectedId, onSelect, onDeselect,
  onChange, onDelete, onDuplicate, onBringToFront, onSendToBack, onFirstWidth,
}: Props, handleRef) {
  const ref = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  // Keep the latest onFirstWidth in a ref so the measuring effect can stay
  // mount-only (the callback identity changes every render).
  const onFirstWidthRef = useRef(onFirstWidth);
  const firstWidthSent = useRef(false);

  // Sync the latest callback into the ref before the measuring effect reads it.
  useLayoutEffect(() => {
    onFirstWidthRef.current = onFirstWidth;
  });

  // Live width: the decoration coordinates are fractions of this, so updating it
  // on every resize makes decorations scale uniformly with the container.
  // Measured synchronously in useLayoutEffect for first paint; jsdom reports 0,
  // so we also accept the first non-zero ResizeObserver tick.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (width: number) => {
      if (width <= 0) return;
      setContentWidth(width);
      if (!firstWidthSent.current) {
        firstWidthSent.current = true;
        onFirstWidthRef.current?.(width);
      }
    };
    apply(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => apply(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useImperativeHandle(handleRef, () => ({
    hitTestBehind(clientX, clientY) {
      const el = ref.current;
      if (!el || contentWidth <= 0) return null;
      const rect = el.getBoundingClientRect();
      return topmostBehindAtPoint(
        decorations,
        clientX - rect.left,
        clientY - rect.top,
        contentWidth,
        (assetId) => getStyleAsset(assetId)?.aspectRatio,
      );
    },
  }), [decorations, contentWidth]);

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
});
