import { describe, it, expect } from 'vitest';
import { resolveAllowedOrigins, corsHeaders } from './cors';

const env = (map: Record<string, string>) => ({ get: (k: string) => map[k] });
const reqWith = (origin?: string) => ({ headers: { get: (n: string) => (n === 'Origin' ? origin ?? null : null) } });

describe('resolveAllowedOrigins', () => {
  it('falls back to the localhost dev origins when ALLOWED_ORIGINS is unset', () => {
    expect(resolveAllowedOrigins(env({}))).toEqual([
      'http://localhost:5173', 'http://127.0.0.1:5173',
      'http://localhost:3000', 'http://127.0.0.1:3000',
    ]);
  });

  it('parses a comma-separated list, trimming whitespace and dropping empties', () => {
    expect(resolveAllowedOrigins(env({ ALLOWED_ORIGINS: 'https://a.com, https://b.com ,' })))
      .toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('corsHeaders', () => {
  const allowed = ['https://app.example.com'];

  it('echoes the Origin when it is allow-listed, with Vary: Origin', () => {
    const h = corsHeaders(reqWith('https://app.example.com'), allowed);
    expect(h['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(h['Vary']).toBe('Origin');
    expect(h['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(h['Access-Control-Allow-Headers']).toContain('authorization');
  });

  it('omits Access-Control-Allow-Origin for a disallowed Origin', () => {
    const h = corsHeaders(reqWith('https://evil.example.com'), allowed);
    expect(h['Access-Control-Allow-Origin']).toBeUndefined();
    expect(h['Vary']).toBe('Origin');
  });

  it('omits Access-Control-Allow-Origin when there is no Origin header (e.g. cron)', () => {
    const h = corsHeaders(reqWith(undefined), allowed);
    expect(h['Access-Control-Allow-Origin']).toBeUndefined();
    expect(h['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
  });
});
