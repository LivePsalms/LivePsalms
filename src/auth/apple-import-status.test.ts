import { describe, it, expect } from 'vitest';
import { detectApplePlatform, deriveImportStatus } from './apple-import-status';

describe('detectApplePlatform', () => {
  it('detects iOS from an iPhone UA', () => {
    expect(detectApplePlatform(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
    )).toBe('ios');
  });
  it('detects iOS from an iPad UA', () => {
    expect(detectApplePlatform(
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
    )).toBe('ios');
  });
  it('treats iPadOS-reports-as-Mac UA as macos (Apple either way)', () => {
    expect(detectApplePlatform(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
    )).toBe('macos');
  });
  it('detects other from an Android UA', () => {
    expect(detectApplePlatform(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
    )).toBe('other');
  });
  it('detects other from a Windows UA', () => {
    expect(detectApplePlatform(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    )).toBe('other');
  });
  it('returns other for an empty UA', () => {
    expect(detectApplePlatform('')).toBe('other');
  });
});

describe('deriveImportStatus', () => {
  const T0 = Date.parse('2026-06-12T12:00:00Z');

  it('idle when no tokens exist', () => {
    expect(deriveImportStatus({ tokenCount: 0, lastUsedAt: null, importedCount: 0, now: T0 }))
      .toEqual({ tone: 'idle', headline: 'Generate a token to get started.', detail: null });
  });

  it('waiting when a token exists but nothing imported yet', () => {
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: null, importedCount: 0, now: T0 }))
      .toEqual({
        tone: 'waiting',
        headline: 'Almost there — run the Shortcut on your device to import.',
        detail: null,
      });
  });

  it('success with pluralized count and relative last-import', () => {
    const lastUsedAt = new Date(T0 - 2 * 60_000).toISOString(); // 2 min ago
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt, importedCount: 5, now: T0 }))
      .toEqual({ tone: 'success', headline: '✅ 5 notes imported', detail: 'last import 2 minutes ago' });
  });

  it('success singularizes "note" for a count of 1', () => {
    const lastUsedAt = new Date(T0 - 30_000).toISOString(); // 30s ago
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt, importedCount: 1, now: T0 }))
      .toEqual({ tone: 'success', headline: '✅ 1 note imported', detail: 'last import just now' });
  });

  it('success omits the detail line when lastUsedAt is null', () => {
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: null, importedCount: 3, now: T0 }))
      .toEqual({ tone: 'success', headline: '✅ 3 notes imported', detail: null });
  });

  it('formats hours and days relative time', () => {
    const threeHours = new Date(T0 - 3 * 3_600_000).toISOString();
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: threeHours, importedCount: 2, now: T0 }).detail)
      .toBe('last import 3 hours ago');
    const twoDays = new Date(T0 - 2 * 86_400_000).toISOString();
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: twoDays, importedCount: 2, now: T0 }).detail)
      .toBe('last import 2 days ago');
  });

  it('singularizes minute/hour/day relative time', () => {
    const oneMinute = new Date(T0 - 60_000).toISOString();
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: oneMinute, importedCount: 2, now: T0 }).detail)
      .toBe('last import 1 minute ago');
    const oneHour = new Date(T0 - 3_600_000).toISOString();
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: oneHour, importedCount: 2, now: T0 }).detail)
      .toBe('last import 1 hour ago');
    const oneDay = new Date(T0 - 86_400_000).toISOString();
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: oneDay, importedCount: 2, now: T0 }).detail)
      .toBe('last import 1 day ago');
  });
});
