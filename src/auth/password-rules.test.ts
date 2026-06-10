import { describe, it, expect } from 'vitest';
import { isPasswordValid, evaluatePassword, PASSWORD_RULES } from './password-rules';

describe('password-rules', () => {
  it('accepts a password meeting all five rules', () => {
    expect(isPasswordValid('Secret1!')).toBe(true);
  });

  it('rejects a password missing exactly one rule', () => {
    expect(isPasswordValid('secret1!')).toBe(false);  // no uppercase
    expect(isPasswordValid('SECRET1!')).toBe(false);  // no lowercase
    expect(isPasswordValid('Secrettt!')).toBe(false); // no number
    expect(isPasswordValid('Secret11')).toBe(false);  // no symbol
    expect(isPasswordValid('Sec1!')).toBe(false);     // too short (5)
  });

  it('evaluatePassword reports per-rule met flags', () => {
    const byId = Object.fromEntries(evaluatePassword('abc').map((r) => [r.id, r.met]));
    expect(byId.lower).toBe(true);
    expect(byId.length).toBe(false);
    expect(byId.upper).toBe(false);
    expect(byId.number).toBe(false);
    expect(byId.symbol).toBe(false);
  });

  it('exposes exactly five rules with labels', () => {
    expect(PASSWORD_RULES).toHaveLength(5);
    expect(PASSWORD_RULES.every((r) => typeof r.label === 'string' && r.label.length > 0)).toBe(true);
  });
});
