// src/components/sections/notepad/mobile/MobileEditorView.tsx
import { MoreHorizontal } from 'lucide-react';
import { NotepadEditor } from '../../../../notepad/components/Editor';
import type { Note } from '../../../../notepad/types';
import { useKeyboardInset } from './useKeyboardInset';

export interface MobileEditorViewProps {
  onOpenDetails: () => void;
  onAfterSave?: (note: Note) => void;
}

export function MobileEditorView({ onOpenDetails, onAfterSave }: MobileEditorViewProps) {
  const keyboardInset = useKeyboardInset();
  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--plaster)' }}>
      <header
        className="shrink-0 flex items-center justify-end px-3"
        style={{ height: 44, borderBottom: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
      >
        <button
          aria-label="Note details"
          onClick={onOpenDetails}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5"
          style={{ color: 'var(--deep-umber)' }}
        >
          <MoreHorizontal size={20} />
        </button>
      </header>

      <div className="flex-1 min-h-0">
        <NotepadEditor
          onAfterSave={onAfterSave}
          toolbarPlacement="bottom"
          toolbarBottomOffset={keyboardInset}
        />
      </div>
    </div>
  );
}
