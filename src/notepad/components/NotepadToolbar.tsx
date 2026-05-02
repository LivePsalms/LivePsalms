import { useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Plus,
  Upload,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotepad } from '../context/useNotepad';
import type { NoteType } from '../types';
import { UploadModal } from './UploadModal';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotepadToolbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  graphOpen: boolean;
  onToggleGraph: () => void;
  onOpenSearch: () => void;
}

// ---------------------------------------------------------------------------
// NotepadToolbar
// ---------------------------------------------------------------------------

export function NotepadToolbar({
  sidebarOpen,
  onToggleSidebar,
  graphOpen,
  onToggleGraph,
  onOpenSearch,
}: NotepadToolbarProps) {
  const { createNote } = useNotepad();
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleNewNote = (type: NoteType) => {
    createNote('root', type);
  };

  // Shared button class
  const btnClass =
    'flex items-center justify-center rounded hover:bg-black/5 transition-colors cursor-pointer';

  return (
    <>
      {/* Toolbar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-end"
        style={{
          height: 108,
          paddingBottom: 0,
          background: 'rgba(240, 236, 232, 0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--pale-stone)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        {/* Inner row — sits at the bottom 48px of the 108px block */}
        <div
          className="flex items-center w-full gap-1 px-3"
          style={{ height: 48, paddingTop: 0 }}
        >
          {/* Sidebar toggle */}
          <button
            onClick={onToggleSidebar}
            className={`${btnClass} w-8 h-8`}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
            ) : (
              <PanelLeftOpen className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
            )}
          </button>

          {/* Search bar button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 flex-1 max-w-xs mx-2 px-3 py-1.5 rounded-md hover:bg-black/5 transition-colors"
            style={{
              background: 'rgba(188, 179, 163, 0.15)',
              border: '1px solid rgba(206, 204, 202, 0.5)',
            }}
          >
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--silica)' }} />
            <span
              className="text-[11px] flex-1 text-left"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              Search notes…
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: 'rgba(188, 179, 163, 0.3)',
                color: 'var(--silica)',
                fontFamily: 'Outfit, sans-serif',
                letterSpacing: '0.05em',
              }}
            >
              ⌘K
            </span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* NEW NOTE dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`${btnClass} flex items-center gap-1.5 px-3 h-8`}
                style={{
                  background: 'var(--deep-umber)',
                  borderRadius: 6,
                }}
              >
                <Plus className="w-3.5 h-3.5" style={{ color: 'var(--plaster)' }} />
                <span
                  className="text-[10px] font-medium tracking-widest"
                  style={{ color: 'var(--plaster)', fontFamily: 'Outfit, sans-serif' }}
                >
                  NEW NOTE
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              style={{ fontFamily: 'Outfit, sans-serif', minWidth: 140 }}
            >
              <DropdownMenuItem
                onClick={() => handleNewNote('devotion')}
                style={{ fontFamily: 'Outfit, sans-serif', fontSize: 12 }}
              >
                Devotion
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleNewNote('sermon')}
                style={{ fontFamily: 'Outfit, sans-serif', fontSize: 12 }}
              >
                Sermon
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleNewNote('theme')}
                style={{ fontFamily: 'Outfit, sans-serif', fontSize: 12 }}
              >
                Theme
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Upload button */}
          <button
            onClick={() => setUploadOpen(true)}
            className={`${btnClass} w-8 h-8 ml-1`}
            title="Upload"
          >
            <Upload className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
          </button>

          {/* Divider */}
          <div
            className="mx-2 self-stretch"
            style={{
              width: 1,
              background: 'var(--pale-stone)',
              marginTop: 10,
              marginBottom: 10,
            }}
          />

          {/* Graph toggle */}
          <button
            onClick={onToggleGraph}
            className={`${btnClass} w-8 h-8`}
            title={graphOpen ? 'Close graph' : 'Open graph'}
          >
            {graphOpen ? (
              <PanelRightClose className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
            ) : (
              <PanelRightOpen className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
            )}
          </button>
        </div>
      </div>

      {/* Upload modal */}
      <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
    </>
  );
}
