// src/notepad/bible/SplitResizeHandle.tsx
import { ChevronsUpDown } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface SplitResizeHandleProps {
  onPointerDown: (e: ReactPointerEvent) => void;
  /** Reset the split to 50/50. */
  onDoubleClick: () => void;
}

/**
 * Draggable divider between the reader and the chat. Drag up/down to resize;
 * double-click to reset. `touch-none` keeps a touch drag from scrolling the page.
 */
export function SplitResizeHandle({ onPointerDown, onDoubleClick }: SplitResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize chat panel — drag up or down, double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className="shrink-0 flex items-center justify-center select-none touch-none"
      style={{
        height: 14,
        cursor: 'row-resize',
        background: 'rgba(231, 222, 210, 0.6)',
        borderTop: '1px solid var(--pale-stone)',
        borderBottom: '1px solid var(--pale-stone)',
      }}
    >
      <ChevronsUpDown className="w-3.5 h-3.5" style={{ color: 'var(--silica)' }} aria-hidden="true" />
    </div>
  );
}
