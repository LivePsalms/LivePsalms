// src/notepad/decorations/DecorationToolbar.tsx
import { FlipHorizontal2, FlipVertical2, ArrowDownToLine, ArrowUpToLine, Copy, Trash2, Check } from 'lucide-react';
import type { NoteDecoration } from '../types';

interface Props {
  decoration: NoteDecoration;
  /** px to lift the bar above the keyboard — mirrors the editor toolbar offset. */
  bottomOffset: number;
  onChange: (next: NoteDecoration) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onDone: () => void;
}

const btn: React.CSSProperties = {
  minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: 'transparent', color: 'var(--charred)', cursor: 'pointer',
};

// Contextual mobile toolbar shown in place of the formatting toolbar while a
// decoration is selected. Pinned to the bottom slot so it can never clip
// off-screen (the failure mode of the old floating pill). Rotation is handled by
// the on-canvas handle + two-finger gesture, so there are no rotate buttons here.
export function DecorationToolbar({
  decoration: d, bottomOffset, onChange, onDelete, onDuplicate, onBringToFront, onSendToBack, onDone,
}: Props) {
  return (
    <div
      data-testid="decoration-toolbar"
      className="shrink-0 flex items-center px-2"
      style={{
        height: 56, background: 'rgba(240, 236, 232, 0.97)',
        borderTop: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif',
        position: 'sticky', bottom: `${bottomOffset}px`, zIndex: 20,
        justifyContent: 'space-around', width: '100%', minWidth: 0,
      }}
    >
      <button aria-label="Flip horizontal" style={btn} onClick={() => onChange({ ...d, flipH: !d.flipH })}><FlipHorizontal2 size={20} /></button>
      <button aria-label="Flip vertical" style={btn} onClick={() => onChange({ ...d, flipV: !d.flipV })}><FlipVertical2 size={20} /></button>
      <button aria-label="Send to back" style={btn} onClick={() => onSendToBack(d.id)}><ArrowDownToLine size={20} /></button>
      <button aria-label="Bring to front" style={btn} onClick={() => onBringToFront(d.id)}><ArrowUpToLine size={20} /></button>
      <button aria-label="Duplicate decoration" style={btn} onClick={() => onDuplicate(d.id)}><Copy size={20} /></button>
      <button aria-label="Delete decoration" style={{ ...btn, color: '#c0392b' }} onClick={() => onDelete(d.id)}><Trash2 size={20} /></button>
      <button aria-label="Done editing decoration" style={{ ...btn, color: 'var(--charred)' }} onClick={onDone}><Check size={20} /></button>
    </div>
  );
}
