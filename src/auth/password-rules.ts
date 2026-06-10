export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export interface PasswordRuleResult {
  id: string;
  label: string;
  met: boolean;
}

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { id: 'upper', label: 'An uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'A lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'A number', test: (pw) => /[0-9]/.test(pw) },
  { id: 'symbol', label: 'A special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function evaluatePassword(pw: string): PasswordRuleResult[] {
  return PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, met: r.test(pw) }));
}

export function isPasswordValid(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}
