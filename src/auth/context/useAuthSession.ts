import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AuthSession, AuthSessionState } from '../session/auth-session';

export const AuthSessionContext = createContext<AuthSession | null>(null);

export function useAuthSession(): AuthSessionState & { session: AuthSession } {
  const session = useContext(AuthSessionContext);
  if (!session) throw new Error('useAuthSession must be used within an AuthProvider');
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return { ...state, session };
}
