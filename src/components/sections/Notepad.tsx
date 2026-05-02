import { useState, useCallback } from 'react';
import { NotepadProvider } from '@/notepad/context/NotepadProvider';
import { NotepadToolbar } from '@/notepad/components/NotepadToolbar';
import { NotepadSidebar } from '@/notepad/components/Sidebar';
import { NotepadEditor } from '@/notepad/components/Editor';
import { BacklinksPanel } from '@/notepad/components/BacklinksPanel';
import { InfoPanel } from '@/notepad/components/InfoPanel';
import { SearchDialog } from '@/notepad/components/SearchDialog';
import { GraphPane } from './notepad/GraphPane';

function NotepadWorkspace() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'content' | 'backlinks' | 'info'>('content');

  const handleOpenSearch = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ top: 0 }}>
      <NotepadToolbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        graphOpen={graphOpen}
        onToggleGraph={() => setGraphOpen(!graphOpen)}
        onOpenSearch={handleOpenSearch}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="shrink-0 overflow-y-auto overflow-x-hidden border-r"
          style={{
            width: sidebarOpen ? 220 : 0,
            borderColor: sidebarOpen ? 'var(--pale-stone)' : 'transparent',
            background: 'rgba(240, 236, 232, 0.6)',
            opacity: sidebarOpen ? 1 : 0,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
          }}
        >
          <NotepadSidebar />
        </aside>

        {/* Editor Pane */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          {/* Tab Bar */}
          <div className="flex items-center gap-0 border-b shrink-0" style={{ borderColor: 'var(--pale-stone)' }}>
            {(['content', 'backlinks', 'info'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-3 text-[11px] font-medium tracking-wider transition-colors relative"
                style={{
                  color: activeTab === tab ? 'var(--deep-umber)' : 'var(--silica)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-5 right-5 h-px" style={{ background: 'var(--deep-umber)' }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'content' && <NotepadEditor />}
          {activeTab === 'backlinks' && <BacklinksPanel />}
          {activeTab === 'info' && <InfoPanel />}
        </main>

        {/* Graph Pane (static placeholder — functionality deferred) */}
        <GraphPane graphOpen={graphOpen} />
      </div>

      <SearchDialog />
    </div>
  );
}

export function Notepad() {
  return (
    <NotepadProvider>
      <NotepadWorkspace />
    </NotepadProvider>
  );
}
