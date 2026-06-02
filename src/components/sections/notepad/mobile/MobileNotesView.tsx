// src/components/sections/notepad/mobile/MobileNotesView.tsx
import { Search, Plus, User } from 'lucide-react';
import { NotepadSidebar } from '../../../../notepad/components/Sidebar';

export interface MobileNotesViewProps {
  onExit: () => void;
  onOpenSearch: () => void;
  onNewNote: () => void;
  onOpenNote: (id: string) => void;
  /** Opens the account menu (signed in) or the sign in / sign up modal (signed out). */
  onOpenAccount?: () => void;
  /** The signed-in user's avatar URL, if they've uploaded one. */
  avatarUrl?: string | null;
}

export function MobileNotesView({
  onExit,
  onOpenSearch,
  onNewNote,
  onOpenNote,
  onOpenAccount,
  avatarUrl,
}: MobileNotesViewProps) {
  return (
    <div className="relative flex flex-col h-full min-h-0" style={{ background: 'var(--plaster)' }}>
      <header
        className="shrink-0 flex items-center justify-between px-3"
        style={{ height: 48, borderBottom: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
      >
        <button
          aria-label="Home"
          onClick={onExit}
          className="flex items-center"
        >
          <img src="/logo-icon.png" alt="LivePsalms" className="h-7 w-auto object-contain" />
        </button>
        <div className="flex items-center gap-1">
          <button
            aria-label="Search notes"
            onClick={onOpenSearch}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5"
            style={{ color: 'var(--deep-umber)' }}
          >
            <Search size={18} />
          </button>
          <button
            aria-label="Account"
            onClick={onOpenAccount}
            className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden hover:bg-black/5"
            style={{ color: 'var(--deep-umber)' }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={18} />
            )}
          </button>
        </div>
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
