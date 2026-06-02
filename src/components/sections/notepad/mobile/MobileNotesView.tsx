// src/components/sections/notepad/mobile/MobileNotesView.tsx
import { ChevronLeft, Search, Plus } from 'lucide-react';
import { NotepadSidebar } from '../../../../notepad/components/Sidebar';

export interface MobileNotesViewProps {
  onExit: () => void;
  onOpenSearch: () => void;
  onNewNote: () => void;
  onOpenNote: (id: string) => void;
}

export function MobileNotesView({ onExit, onOpenSearch, onNewNote, onOpenNote }: MobileNotesViewProps) {
  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--plaster)' }}>
      <header
        className="shrink-0 flex items-center justify-between px-3"
        style={{ height: 48, borderBottom: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
      >
        <button
          aria-label="Back to Psalms"
          onClick={onExit}
          className="flex items-center gap-1 text-[13px]"
          style={{ color: 'var(--deep-umber)' }}
        >
          <ChevronLeft size={18} />
          Psalms
        </button>
        <button
          aria-label="Search notes"
          onClick={onOpenSearch}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5"
          style={{ color: 'var(--deep-umber)' }}
        >
          <Search size={18} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        <NotepadSidebar hideCollectionHeader={false} onOpenNote={onOpenNote} />
      </div>

      <button
        aria-label="New note"
        onClick={onNewNote}
        className="absolute right-4 flex items-center justify-center rounded-full shadow-lg"
        style={{
          bottom: 'calc(72px + env(safe-area-inset-bottom))',
          width: 52,
          height: 52,
          background: '#b8843a',
          color: '#fff',
        }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
