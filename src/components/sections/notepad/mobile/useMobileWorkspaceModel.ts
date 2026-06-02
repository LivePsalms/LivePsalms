// src/components/sections/notepad/mobile/useMobileWorkspaceModel.ts
import { useCallback, useMemo } from 'react';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useNoteCollection } from '../../../../notepad/context/useNoteCollection';
import { useOnlineStatus } from '../../../../notepad/hooks/useOnlineStatus';
import { useLamplightSettings } from '../../../../notepad/hooks/useLamplightSettings';
import { useLamplightEmbeddingTrigger } from '../../../../notepad/hooks/useLamplightEmbeddingTrigger';
import { SupabaseLamplightAdapter } from '../../../../notepad/storage/supabase-lamplight-adapter';
import type { LamplightAdapter } from '../../../../notepad/storage/lamplight-adapter';
import type { Note } from '../../../../notepad/types';
import { supabase } from '@/lib/supabase';

export interface MobileWorkspaceModel {
  user: { id: string } | null;
  notes: Note[];
  activeNote: Note | null;
  totalNoteCount: number;
  isOnline: boolean;
  openNote: (id: string) => void;
  createNote: (folderId: string, type: 'devotion' | 'sermon' | 'theme') => void;
  lamplightAdapter: LamplightAdapter | null;
  onAfterSave: (note: Note) => void;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
}

export function useMobileWorkspaceModel(): MobileWorkspaceModel {
  const { user } = useAuthSession();
  const { notes, activeNote, collection } = useNoteCollection();
  const isOnline = useOnlineStatus();

  const lamplightAdapter = useMemo(
    () => (supabase ? new SupabaseLamplightAdapter(supabase) : null),
    [],
  );

  const { settings: lamplightSettings } = useLamplightSettings({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: lamplightAdapter as any,
    userId: lamplightAdapter ? (user?.id ?? null) : null,
  });

  const onAfterSave = useLamplightEmbeddingTrigger({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: lamplightAdapter as any,
    enabled: !!(lamplightAdapter && lamplightSettings?.enabled),
    userId: lamplightAdapter ? (user?.id ?? null) : null,
    invoke: (name, options) => supabase!.functions.invoke(name, options),
  });

  const loadNeighborNotes = useCallback(
    async (ids: string[]) => notes.filter((n) => ids.includes(n.id)),
    [notes],
  );

  return {
    user: user ? { id: user.id } : null,
    notes,
    activeNote,
    totalNoteCount: notes.length,
    isOnline,
    openNote: collection.openNote,
    createNote: collection.createNote,
    lamplightAdapter,
    onAfterSave,
    loadNeighborNotes,
  };
}
