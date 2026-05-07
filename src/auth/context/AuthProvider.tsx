import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { localAdapter } from '@/notepad/storage/local-storage';
import { AuthSession } from '../session/auth-session';
import { AccountProfile } from '../profile/account-profile';
import { AccountActions } from '../account-actions';
import { AuthSessionContext } from './useAuthSession';
import { AccountProfileContext } from './useAccountProfile';
import { AccountActionsContext } from './useAccountActions';

/**
 * Wires `AuthSession`, `AccountProfile`, and `AccountActions` into the React
 * tree. The Provider holds nothing of its own — all state lives in the three
 * classes. Compare with `NotepadProvider` for the same pattern in the notepad
 * domain.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { session, profile, actions } = useMemo(() => {
    const session = new AuthSession(supabase, localAdapter);
    const profile = new AccountProfile(supabase, session);
    const actions = new AccountActions(supabase, session, profile);
    return { session, profile, actions };
  }, []);

  useEffect(() => {
    session.init();
    profile.init();
    return () => {
      profile.dispose();
      session.dispose();
    };
  }, [session, profile]);

  return (
    <AuthSessionContext.Provider value={session}>
      <AccountProfileContext.Provider value={profile}>
        <AccountActionsContext.Provider value={actions}>
          {children}
        </AccountActionsContext.Provider>
      </AccountProfileContext.Provider>
    </AuthSessionContext.Provider>
  );
}
