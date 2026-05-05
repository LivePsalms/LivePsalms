import { createContext, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from './types';
import type { StorageAdapter } from '@/notepad/storage/adapter';
import { LocalStorageAdapter } from '@/notepad/storage/local-storage';
import { SupabaseStorageAdapter } from '@/notepad/storage/supabase-adapter';

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
  adapter: StorageAdapter;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'fullName' | 'dateOfBirth' | 'avatarUrl'>>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  deleteAccount: () => Promise<void>;
  exportData: () => Promise<{ notes: unknown[]; folders: unknown[] }>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const localAdapter = new LocalStorageAdapter();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [adapter, setAdapter] = useState<StorageAdapter>(localAdapter);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch profile from Supabase
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      fullName: data.full_name,
      dateOfBirth: data.date_of_birth,
      avatarUrl: data.avatar_url,
      noteCount: data.note_count,
      highestNoteCount: data.highest_note_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setUser(s?.user ?? null);
      if (s?.user) {
        setAdapter(new SupabaseStorageAdapter(supabase!, s.user.id));
        fetchProfile(s.user.id).then((p) => {
          setProfile(p);
          setLoading(false);
        });
      } else {
        setAdapter(localAdapter);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setUser(s?.user ?? null);
        if (s?.user) {
          setAdapter(new SupabaseStorageAdapter(supabase!, s.user.id));
          const p = await fetchProfile(s.user.id);
          setProfile(p);
        } else {
          setAdapter(localAdapter);
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) throw error;
  }, []);

  const signInWithApple = useCallback(async () => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'apple' });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAdapter(localAdapter);
  }, []);

  const updateProfile = useCallback(async (
    updates: Partial<Pick<UserProfile, 'fullName' | 'dateOfBirth' | 'avatarUrl'>>
  ) => {
    if (!supabase || !user) throw new Error('Not authenticated');
    const mapped: Record<string, unknown> = {};
    if (updates.fullName !== undefined) mapped.full_name = updates.fullName;
    if (updates.dateOfBirth !== undefined) mapped.date_of_birth = updates.dateOfBirth;
    if (updates.avatarUrl !== undefined) mapped.avatar_url = updates.avatarUrl;

    const { error } = await supabase
      .from('profiles')
      .update(mapped)
      .eq('id', user.id);
    if (error) throw error;

    const refreshed = await fetchProfile(user.id);
    setProfile(refreshed);
  }, [user, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    setProfile(p);
  }, [user, fetchProfile]);

  const uploadAvatar = useCallback(async (file: File): Promise<string> => {
    if (!supabase || !user) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl;

    await updateProfile({ avatarUrl: url });
    return url;
  }, [user, updateProfile]);

  const deleteAccount = useCallback(async () => {
    if (!supabase || !user) throw new Error('Not authenticated');
    // Delete avatar from storage
    if (profile?.avatarUrl) {
      const path = `${user.id}/`;
      await supabase.storage.from('avatars').remove([path]);
    }
    // Notes and folders cascade-delete via FK on profiles
    // Delete profile (cascade deletes notes/folders)
    await supabase.from('profiles').delete().eq('id', user.id);
    // Sign out
    await supabase.auth.signOut();
    setAdapter(localAdapter);
  }, [user, profile]);

  const exportData = useCallback(async () => {
    const notes = await adapter.getNotes();
    const folders = await adapter.getFolders();
    return { notes, folders };
  }, [adapter]);

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    isOnline,
    adapter,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    updateProfile,
    refreshProfile,
    uploadAvatar,
    deleteAccount,
    exportData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
