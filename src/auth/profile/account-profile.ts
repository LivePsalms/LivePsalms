import type { SupabaseClient } from '@supabase/supabase-js';
import { Observable } from '@/notepad/collection/observable';
import type { UserProfile, ProfileStatus } from '../types';
import type { AuthSession } from '../session/auth-session';

export interface AccountProfileState {
  profile: UserProfile | null;
  profileStatus: ProfileStatus;
}

const EMPTY_STATE: AccountProfileState = {
  profile: null,
  profileStatus: 'missing',
};

/**
 * The active user's profile row. Subscribes to `AuthSession` and refetches
 * whenever `user.id` changes. Snake_case ↔ camelCase mapping is concentrated
 * in `mapProfile`. `profileStatus` is a four-state machine; `profile` is null
 * in every non-`'loaded'` state.
 */
export class AccountProfile extends Observable<AccountProfileState> {
  private readonly client: SupabaseClient | null;
  private readonly session: AuthSession;
  private unsubscribe: (() => void) | null = null;
  private currentUserId: string | null = null;

  constructor(client: SupabaseClient | null, session: AuthSession) {
    super(EMPTY_STATE);
    this.client = client;
    this.session = session;
  }

  init(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.session.subscribe(() => {
      this.handleSessionChange();
    });
    // Apply current session synchronously in case the session already has a user.
    this.handleSessionChange();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  refreshProfile = async (): Promise<void> => {
    const userId = this.session.getSnapshot().user?.id;
    if (userId) await this.fetchProfile(userId);
  };

  updateProfile = async (
    updates: Partial<Pick<UserProfile, 'fullName' | 'dateOfBirth' | 'avatarUrl'>>,
  ): Promise<void> => {
    const userId = this.session.getSnapshot().user?.id;
    if (!this.client || !userId) throw new Error('Not authenticated');
    const mapped: Record<string, unknown> = {};
    if (updates.fullName !== undefined) mapped.full_name = updates.fullName;
    if (updates.dateOfBirth !== undefined) mapped.date_of_birth = updates.dateOfBirth;
    if (updates.avatarUrl !== undefined) mapped.avatar_url = updates.avatarUrl;
    const { error } = await this.client.from('profiles').update(mapped).eq('id', userId);
    if (error) throw error;
    await this.fetchProfile(userId);
  };

  uploadAvatar = async (file: File): Promise<string> => {
    const userId = this.session.getSnapshot().user?.id;
    if (!this.client || !userId) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadError } = await this.client.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data } = this.client.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl;
    await this.updateProfile({ avatarUrl: url });
    return url;
  };

  private handleSessionChange(): void {
    const userId = this.session.getSnapshot().user?.id ?? null;
    if (userId === this.currentUserId) return;
    this.currentUserId = userId;
    if (userId) {
      void this.fetchProfile(userId);
    } else {
      this.update(() => EMPTY_STATE);
    }
  }

  private async fetchProfile(userId: string): Promise<void> {
    if (!this.client) {
      this.update(() => ({ profile: null, profileStatus: 'error' }));
      return;
    }
    this.update((prev) => ({ ...prev, profileStatus: 'loading' }));
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      // Race fence: drop the result if the active user changed mid-flight.
      if (this.currentUserId !== userId) return;
      if (!data) {
        this.update(() => ({ profile: null, profileStatus: 'missing' }));
      } else {
        this.update(() => ({ profile: mapProfile(data), profileStatus: 'loaded' }));
      }
    } catch {
      if (this.currentUserId !== userId) return;
      this.update(() => ({ profile: null, profileStatus: 'error' }));
    }
  }

  private update(updater: (prev: AccountProfileState) => AccountProfileState): void {
    this.setState(updater);
  }
}

function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    dateOfBirth: (row.date_of_birth as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    noteCount: (row.note_count as number) ?? 0,
    highestNoteCount: (row.highest_note_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
