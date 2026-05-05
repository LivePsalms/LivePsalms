import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PanelLeftClose, PanelLeftOpen, WifiOff } from 'lucide-react';
import { NotepadProvider } from '@/notepad/context/NotepadProvider';
import { useAuth } from '@/auth/useAuth';
import { useNotepad } from '@/notepad/context/useNotepad';
import { NotepadToolbar } from '@/notepad/components/NotepadToolbar';
import { NotepadSidebar } from '@/notepad/components/Sidebar';
import { NotepadEditor } from '@/notepad/components/Editor';
import { BacklinksPanel } from '@/notepad/components/BacklinksPanel';
import { InfoPanel } from '@/notepad/components/InfoPanel';
import { SearchDialog } from '@/notepad/components/SearchDialog';
import { MigrationDialog } from '@/notepad/components/MigrationDialog';
import { GraphPane } from './notepad/GraphPane';
import { useOnlineStatus } from '@/notepad/hooks/useOnlineStatus';

function NotepadWorkspace() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'backlinks' | 'info'>('content');

  const navigate = useNavigate();
  const { user, adapter, loading: authLoading } = useAuth();
  const { refresh } = useNotepad();
  const [showMigration, setShowMigration] = useState(false);

  const isOnline = useOnlineStatus();
  const isLoggedIn = !!user;
  const isOfflineAndLoggedIn = !isOnline && isLoggedIn;

  // First-time user: redirect to welcome screen, then show signed-in toast
  useEffect(() => {
    if (authLoading || !user) return;
    const welcomedKey = `welcomed_${user.id}`;
    if (!localStorage.getItem(welcomedKey)) {
      navigate('/welcome');
      return;
    }
    const greetedKey = `greeted_${user.id}_${new Date().toDateString()}`;
    if (!sessionStorage.getItem(greetedKey)) {
      sessionStorage.setItem(greetedKey, 'true');
      const firstName = user.user_metadata?.full_name?.split(' ')[0]
        ?? user.email?.split('@')[0]
        ?? 'friend';
      toast.success(`Welcome back, ${firstName}!`);
    }
  }, [user, authLoading, navigate]);

  // Check for local notes when user logs in
  useEffect(() => {
    if (user) {
      const localNotes = localStorage.getItem('notepad_notes');
      if (localNotes) {
        const parsed = JSON.parse(localNotes);
        if (parsed.length > 0) {
          setShowMigration(true);
        }
      }
    }
  }, [user]);

  const handleOpenSearch = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ top: 0 }}>
      <NotepadToolbar
        graphOpen={graphOpen}
        onToggleGraph={() => setGraphOpen(!graphOpen)}
        onOpenSearch={handleOpenSearch}
      />

      {isOfflineAndLoggedIn && (
        <div
          className="flex items-center justify-center gap-2 py-2 text-xs"
          style={{
            background: 'rgba(232, 169, 58, 0.15)',
            borderBottom: '1px solid rgba(232, 169, 58, 0.3)',
            color: 'var(--deep-umber)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          <WifiOff className="w-3.5 h-3.5" />
          You're offline — viewing cached notes
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — stays visible when graph expands */}
        <div
          className="shrink-0 flex flex-col border-r"
          style={{
            width: sidebarOpen ? 220 : 48,
            borderColor: 'var(--pale-stone)',
            background: 'rgba(240, 236, 232, 0.6)',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Sidebar header with COLLECTION + toggle */}
          <div
            className="flex items-center shrink-0 px-4 pt-4 pb-2"
            style={{ minHeight: 40 }}
          >
            {sidebarOpen && (
              <h3
                className="text-[10px] font-medium tracking-[0.2em] flex-1"
                style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
              >
                COLLECTION
              </h3>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-black/5 transition-colors cursor-pointer"
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              style={{ marginLeft: sidebarOpen ? 0 : 'auto', marginRight: sidebarOpen ? 0 : 'auto' }}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-3.5 h-3.5" style={{ color: 'var(--silica)' }} />
              ) : (
                <PanelLeftOpen className="w-3.5 h-3.5" style={{ color: 'var(--silica)' }} />
              )}
            </button>
          </div>

          {/* Sidebar content — hidden when collapsed */}
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{
              opacity: sidebarOpen ? 1 : 0,
              transition: 'opacity 0.3s ease',
              pointerEvents: sidebarOpen ? 'auto' : 'none',
            }}
          >
            {sidebarOpen && <NotepadSidebar hideCollectionHeader />}
          </div>
        </div>

        {/* Editor Pane — hidden when graph is expanded */}
        <main
          className="overflow-y-auto flex flex-col min-w-0"
          style={{
            flex: graphExpanded ? '0 0 0px' : '1 1 0%',
            opacity: graphExpanded ? 0 : 1,
            transition: 'flex 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
            overflow: 'hidden',
          }}
        >
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
        <GraphPane graphOpen={graphOpen} expanded={graphExpanded} onToggleExpand={() => setGraphExpanded(!graphExpanded)} />
      </div>

      <SearchDialog />
      <MigrationDialog
        open={showMigration}
        onClose={() => setShowMigration(false)}
        targetAdapter={adapter}
        onMigrationComplete={refresh}
      />
    </div>
  );
}

export function Notepad() {
  const { adapter } = useAuth();
  return (
    <NotepadProvider adapter={adapter}>
      <NotepadWorkspace />
    </NotepadProvider>
  );
}
