import { createContext, useContext } from 'react';
import type { AccountActions } from '../account-actions';

export const AccountActionsContext = createContext<AccountActions | null>(null);

export function useAccountActions(): AccountActions {
  const actions = useContext(AccountActionsContext);
  if (!actions) throw new Error('useAccountActions must be used within an AuthProvider');
  return actions;
}
