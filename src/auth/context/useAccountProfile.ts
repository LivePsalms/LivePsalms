import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AccountProfile, AccountProfileState } from '../profile/account-profile';

export const AccountProfileContext = createContext<AccountProfile | null>(null);

export function useAccountProfile(): AccountProfileState & { account: AccountProfile } {
  const account = useContext(AccountProfileContext);
  if (!account) throw new Error('useAccountProfile must be used within an AuthProvider');
  const state = useSyncExternalStore(account.subscribe, account.getSnapshot);
  return { ...state, account };
}
