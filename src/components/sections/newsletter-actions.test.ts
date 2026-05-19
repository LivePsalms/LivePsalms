import { describe, it, expect } from 'vitest';
import { isValidEmail } from './newsletter-actions';

describe('isValidEmail', () => {
  it('returns true for a normal address', () => {
    expect(isValidEmail('hello@example.com')).toBe(true);
  });

  it('returns true for an address with a subdomain', () => {
    expect(isValidEmail('user.name@mail.example.co')).toBe(true);
  });

  it('returns true after trimming surrounding whitespace', () => {
    expect(isValidEmail('  hello@example.com  ')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('returns false for whitespace-only input', () => {
    expect(isValidEmail('   ')).toBe(false);
  });

  it('returns false for a bare word', () => {
    expect(isValidEmail('foo')).toBe(false);
  });

  it('returns false when the local part is missing', () => {
    expect(isValidEmail('@bar.com')).toBe(false);
  });

  it('returns false when the @ is missing', () => {
    expect(isValidEmail('foobar.com')).toBe(false);
  });

  it('returns false when the TLD is missing', () => {
    expect(isValidEmail('foo@bar')).toBe(false);
  });
});
