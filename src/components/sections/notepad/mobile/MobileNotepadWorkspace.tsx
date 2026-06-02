// src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useAccountProfile } from '@/auth/context/useAccountProfile';
import { useNotepadActions } from '../../../../notepad/context/useNotepadActions';
import { filesToNotes } from '../../../../notepad/import/document-importer';
import { useNotepadFirstLoad } from '../../../../notepad/first-load/useNotepadFirstLoad';
import { SearchDialog } from '../../../../notepad/components/SearchDialog';
import { MigrationDialog } from '../../../../notepad/components/MigrationDialog';
import { MobileTabBar } from './MobileTabBar';
import { MobileNotesView } from './MobileNotesView';
import { MobileEditorView } from './MobileEditorView';
import { LamplightMobileView } from './LamplightMobileView';
import { MobileMoreSheet } from './MobileMoreSheet';
import { MobileAuthModal } from './MobileAuthModal';
import { MobileAccountSheet } from './MobileAccountSheet';
import { useMobileWorkspaceModel } from './useMobileWorkspaceModel';
import { useHasConnections } from './useHasConnections';
import type { MobileTab } from './types';

export function MobileNotepadWorkspace() {
  const navigate = useNavigate();
  const model = useMobileWorkspaceModel();
  const actions = useNotepadActions();
  const { adapter, session } = useAuthSession();
  const { profile } = useAccountProfile();
  const { showMigration, dismissMigration } = useNotepadFirstLoad();

  const [tab, setTab] = useState<MobileTab>('notes');
  const [moreOpen, setMoreOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const openAccount = useCallback(() => {
    if (model.user) {
      setAccountOpen(true);
    } else {
      setAuthOpen(true);
    }
  }, [model.user]);

  const handleSignOut = useCallback(async () => {
    setAccountOpen(false);
    await session.signOut();
    navigate('/notepad');
  }, [session, navigate]);

  const { openNote, createNote } = model;

  const hasConnections = useHasConnections({
    adapter: model.lamplightAdapter,
    userId: model.user?.id ?? null,
    activeNote: model.activeNote,
    totalNoteCount: model.totalNoteCount,
    loadNeighborNotes: model.loadNeighborNotes,
  });

  const openSearch = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }, []);

  const handleSelectTab = useCallback((next: MobileTab) => {
    if (next === 'more') {
      setMoreOpen(true);
      return;
    }
    setMoreOpen(false);
    setTab(next);
  }, []);

  const handleOpenNote = useCallback(
    (id: string) => {
      openNote(id);
      setTab('editor');
    },
    [openNote],
  );

  const handleNewNote = useCallback(() => {
    createNote('root', 'devotion');
    setTab('editor');
  }, [createNote]);

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      const notes = await filesToNotes(files, {
        folderId: 'root',
        autoDetectVerses: true,
      });
      await actions.importNotes(notes);
    },
    [actions],
  );

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--plaster)' }}>
      {!model.isOnline && model.user && (
        <div
          className="flex items-center justify-center gap-2 py-2 text-xs shrink-0"
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

      <div className="flex-1 min-h-0 relative">
        {tab === 'notes' && (
          <MobileNotesView
            onExit={() => navigate('/')}
            onOpenSearch={openSearch}
            onNewNote={handleNewNote}
            onUploadFiles={handleUploadFiles}
            onOpenNote={handleOpenNote}
            onOpenAccount={openAccount}
            avatarUrl={profile?.avatarUrl ?? null}
          />
        )}
        {tab === 'editor' && (
          <MobileEditorView
            onOpenDetails={() => setMoreOpen(true)}
            onExit={() => navigate('/')}
            onAfterSave={model.onAfterSave}
            onOpenAccount={openAccount}
            avatarUrl={profile?.avatarUrl ?? null}
            hasActiveNote={!!model.activeNote}
            onNewNote={handleNewNote}
          />
        )}
        {tab === 'lamplight' && model.lamplightAdapter && (
          <LamplightMobileView
            lamplightAdapter={model.lamplightAdapter}
            userId={model.user?.id ?? null}
            activeNote={model.activeNote}
            totalNoteCount={model.totalNoteCount}
            loadNeighborNotes={model.loadNeighborNotes}
            onOpenNote={handleOpenNote}
          />
        )}
        {tab === 'lamplight' && !model.lamplightAdapter && (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            Lamplight unavailable — Supabase not configured.
          </div>
        )}
      </div>

      <MobileTabBar active={tab} onSelect={handleSelectTab} lamplightHasConnections={hasConnections} />

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />

      <MobileAuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <MobileAccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onProfile={() => {
          setAccountOpen(false);
          navigate('/profile');
        }}
        onSignOut={handleSignOut}
      />

      <SearchDialog />
      <MigrationDialog
        open={showMigration}
        onClose={dismissMigration}
        targetAdapter={adapter}
        onMigrationComplete={() => actions.init()}
      />
    </div>
  );
}
