export type PasswordManagedBy = 'Google' | 'Apple' | 'your linked account';

export interface PasswordCapability {
  canChange: boolean;
  managedBy: PasswordManagedBy | null;
}

interface ProviderCarrier {
  app_metadata?: { providers?: string[] | null } | null;
}

/**
 * Determines whether the Security UI should offer "Change Password".
 * Presentational only — `canChange` is true iff the account has an email/password identity.
 */
export function getPasswordCapability(
  user: ProviderCarrier | null | undefined
): PasswordCapability {
  const providers = user?.app_metadata?.providers ?? [];
  if (providers.includes('email')) return { canChange: true, managedBy: null };
  if (providers.includes('google')) return { canChange: false, managedBy: 'Google' };
  if (providers.includes('apple')) return { canChange: false, managedBy: 'Apple' };
  return { canChange: false, managedBy: 'your linked account' };
}
