import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthSession } from './session/auth-session';
import type { AccountProfile } from './profile/account-profile';

/**
 * Coordinator for account-level multi-module sequencing. Stateless. Mirrors
 * the role of `NotepadActions` in the notepad domain.
 *
 * `AuthSession` and `AccountProfile` do not know each other; cross-module
 * knowledge concentrates here.
 */
export class AccountActions {
  private readonly client: SupabaseClient | null;
  private readonly session: AuthSession;
  private readonly profile: AccountProfile;

  constructor(client: SupabaseClient | null, session: AuthSession, profile: AccountProfile) {
    this.client = client;
    this.session = session;
    this.profile = profile;
  }

  deleteAccount = async (): Promise<void> => {
    const { user } = this.session.getSnapshot();
    if (!this.client || !user) throw new Error('Not authenticated');

    const { profile } = this.profile.getSnapshot();
    if (profile?.avatarUrl) {
      // Best-effort cleanup; the directory path removes any uploaded avatars.
      await this.client.storage.from('avatars').remove([`${user.id}/`]);
    }

    // Profile row delete cascades to notes and folders via FK.
    await this.client.from('profiles').delete().eq('id', user.id);

    // signOut flows through the auth listener and resets the adapter to local.
    await this.session.signOut();
  };

  /**
   * Export all Notes and Folders for the active user as JSON. Reads from the
   * adapter because `ProfilePage` (the only consumer) lives outside
   * `<NotepadProvider>` and has no in-memory `NoteCollection` to read from.
   */
  exportData = async (): Promise<{ notes: unknown[]; folders: unknown[] }> => {
    const { adapter } = this.session.getSnapshot();
    const notes = await adapter.getNotes();
    const folders = await adapter.getFolders();
    return { notes, folders };
  };
}
