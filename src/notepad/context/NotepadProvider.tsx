import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Note, Folder, NoteType, FolderIcon, JournalTheme } from '../types';
import type { StorageAdapter } from '../storage/adapter';
import { LocalStorageAdapter } from '../storage/local-storage';
import type { GraphNode, GraphEdge } from '../graph/types';
import { useGraph } from '../graph/use-graph';

export interface NotepadContextValue {
  // State
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  activeNote: Note | null;

  // Note actions
  openNote: (id: string | null) => void;
  createNote: (folderId: string, type: NoteType) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  duplicateNote: (id: string) => Promise<Note>;
  moveNote: (id: string, folderId: string) => Promise<Note>;
  renameNote: (id: string, title: string) => Promise<Note>;

  // Folder actions
  createFolder: (name: string, parentId: string | null, icon?: FolderIcon, color?: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<Folder>;
  deleteFolder: (id: string) => Promise<void>;

  // Bulk
  importNotes: (items: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;

  refresh: () => Promise<void>;

  // Journal theme
  journalTheme: JournalTheme;
  setJournalTheme: (theme: JournalTheme) => void;

  // Graph
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  graphActiveNodeId: string | null;
  graphLoading: boolean;
  rebuildGraph: () => void;
  getNeighborhood: (nodeId: string, depth: number) => Set<string>;
}

export const NotepadContext = createContext<NotepadContextValue | null>(null);

interface NotepadProviderProps {
  children: ReactNode;
  adapter?: StorageAdapter;
}

export function NotepadProvider({ children, adapter: adapterProp }: NotepadProviderProps) {
  const [adapterVersion, setAdapterVersion] = useState(0);
  const adapterRef = useRef<StorageAdapter>(adapterProp ?? new LocalStorageAdapter());

  // Update adapter when prop changes (user logs in/out)
  useEffect(() => {
    if (adapterProp && adapterProp !== adapterRef.current) {
      adapterRef.current = adapterProp;
      setAdapterVersion((v) => v + 1);
    }
  }, [adapterProp]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [journalTheme, setJournalThemeState] = useState<JournalTheme>(() => {
    try {
      return (localStorage.getItem('psalms-journal-theme') as JournalTheme) || 'default';
    } catch {
      return 'default';
    }
  });

  const setJournalTheme = useCallback((theme: JournalTheme) => {
    setJournalThemeState(theme);
    try { localStorage.setItem('psalms-journal-theme', theme); } catch { /* noop */ }
  }, []);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  const graph = useGraph(notes, activeNoteId);

  const refresh = useCallback(async () => {
    const [fetchedNotes, fetchedFolders] = await Promise.all([
      adapterRef.current.getNotes(),
      adapterRef.current.getFolders(),
    ]);
    setNotes(fetchedNotes);
    setFolders(fetchedFolders);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, adapterVersion]);

  const openNote = useCallback((id: string | null) => {
    setActiveNoteId(id);
  }, []);

  const createNote = useCallback(
    async (folderId: string, type: NoteType): Promise<Note> => {
      const note = await adapterRef.current.createNote({
        title: 'Untitled',
        content: '',
        folderId,
        type,
        tags: [],
      });
      await refresh();
      setActiveNoteId(note.id);
      return note;
    },
    [refresh],
  );

  const updateNote = useCallback(
    async (id: string, updates: Partial<Note>): Promise<Note> => {
      const updated = await adapterRef.current.updateNote(id, updates);
      await refresh();
      return updated;
    },
    [refresh],
  );

  const deleteNote = useCallback(
    async (id: string): Promise<void> => {
      await adapterRef.current.deleteNote(id);
      setActiveNoteId((prev) => (prev === id ? null : prev));
      await refresh();
    },
    [refresh],
  );

  const duplicateNote = useCallback(
    async (id: string): Promise<Note> => {
      const dup = await adapterRef.current.duplicateNote(id);
      await refresh();
      return dup;
    },
    [refresh],
  );

  const moveNote = useCallback(
    async (id: string, folderId: string): Promise<Note> => {
      const updated = await adapterRef.current.updateNote(id, { folderId });
      await refresh();
      return updated;
    },
    [refresh],
  );

  const renameNote = useCallback(
    async (id: string, title: string): Promise<Note> => {
      const updated = await adapterRef.current.updateNote(id, { title });
      await refresh();
      return updated;
    },
    [refresh],
  );

  const createFolder = useCallback(
    async (name: string, parentId: string | null, icon?: FolderIcon, color?: string): Promise<Folder> => {
      const siblings = folders.filter((f) => f.parentId === parentId);
      const order = siblings.length;
      const folder = await adapterRef.current.createFolder({ name, parentId, order, icon, color });
      await refresh();
      return folder;
    },
    [folders, refresh],
  );

  const renameFolder = useCallback(
    async (id: string, name: string): Promise<Folder> => {
      const updated = await adapterRef.current.updateFolder(id, { name });
      await refresh();
      return updated;
    },
    [refresh],
  );

  const deleteFolder = useCallback(
    async (id: string): Promise<void> => {
      await adapterRef.current.deleteFolder(id);
      await refresh();
    },
    [refresh],
  );

  const importNotes = useCallback(
    async (items: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> => {
      for (const item of items) {
        await adapterRef.current.createNote(item);
      }
      await refresh();
    },
    [refresh],
  );

  const value: NotepadContextValue = {
    notes,
    folders,
    activeNoteId,
    activeNote,
    openNote,
    createNote,
    updateNote,
    deleteNote,
    duplicateNote,
    moveNote,
    renameNote,
    createFolder,
    renameFolder,
    deleteFolder,
    importNotes,
    refresh,
    journalTheme,
    setJournalTheme,
    graphNodes: graph.nodes,
    graphEdges: graph.edges,
    graphActiveNodeId: graph.activeNodeId,
    graphLoading: graph.isLoading,
    rebuildGraph: graph.rebuildGraph,
    getNeighborhood: graph.getNeighborhood,
  };

  return <NotepadContext.Provider value={value}>{children}</NotepadContext.Provider>;
}
