// src/auth/apple-import-status.ts
// Pure, DOM-free logic for the Connect Apple Notes panel. Unit-tested in isolation.

export type ApplePlatform = 'ios' | 'macos' | 'other';

// Best-effort from navigator.userAgent. iPadOS Safari reports as Mac; that's fine —
// both are Apple and the iCloud Shortcut link works on both. Only Apple-vs-not is
// load-bearing here.
export function detectApplePlatform(userAgent: string): ApplePlatform {
  const ua = userAgent ?? '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Macintosh|Mac OS X/.test(ua)) return 'macos';
  return 'other';
}

export type ImportTone = 'idle' | 'waiting' | 'success';
export interface ImportStatus {
  tone: ImportTone;
  headline: string;
  detail: string | null;
}

// "just now" / "N minute(s)/hour(s)/day(s) ago", driven by an injectable `now`.
function formatRelative(iso: string, now: number): string {
  const sec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

// Pure derivation from data the panel already has. Never throws on missing data.
export function deriveImportStatus(input: {
  tokenCount: number;
  lastUsedAt: string | null; // most recent across the user's active tokens
  importedCount: number;
  now?: number; // injectable for deterministic relative-time tests
}): ImportStatus {
  const { tokenCount, lastUsedAt, importedCount } = input;
  const now = input.now ?? Date.now();

  if (tokenCount === 0) {
    return { tone: 'idle', headline: 'Generate a token to get started.', detail: null };
  }
  if (lastUsedAt == null && importedCount === 0) {
    return {
      tone: 'waiting',
      headline: 'Almost there — run the Shortcut on your device to import.',
      detail: null,
    };
  }
  const noun = importedCount === 1 ? 'note' : 'notes';
  return {
    tone: 'success',
    headline: `✅ ${importedCount} ${noun} imported`,
    detail: lastUsedAt == null ? null : `last import ${formatRelative(lastUsedAt, now)}`,
  };
}
