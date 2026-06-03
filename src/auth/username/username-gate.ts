import type { ProfileStatus } from '@/auth/types';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useAccountProfile } from '@/auth/context/useAccountProfile';

export type UsernameGate =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'needs-username' }
  | { kind: 'ready'; username: string };

export interface UsernameGateInput {
  sessionLoading: boolean;
  hasUser: boolean;
  profileStatus: ProfileStatus;
  username: string | null;
}

/**
 * Pure classifier for the notepad username gate. A signed-in user always has a
 * profile row (created by the on_auth_user_created trigger), so `missing`/`error`
 * are transient and map to `loading` rather than flashing the picker or leaking
 * the editor.
 */
export function computeUsernameGate(input: UsernameGateInput): UsernameGate {
  if (input.sessionLoading) return { kind: 'loading' };
  if (!input.hasUser) return { kind: 'signed-out' };
  if (input.profileStatus !== 'loaded') return { kind: 'loading' };
  if (!input.username) return { kind: 'needs-username' };
  return { kind: 'ready', username: input.username };
}

export function useUsernameGate(): UsernameGate {
  const { user, loading } = useAuthSession();
  const { profile, profileStatus } = useAccountProfile();
  return computeUsernameGate({
    sessionLoading: loading,
    hasUser: !!user,
    profileStatus,
    username: profile?.username ?? null,
  });
}
