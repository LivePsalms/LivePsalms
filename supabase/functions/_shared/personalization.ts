// Pure first-name sanitizer. Imported by:
//   - supabase/functions/lamplight-generate (Deno runtime)
//   - src/notepad/utils/personalization.ts re-export contract (Node + browser)
//
// The whitelist is the only defense against prompt injection through profile
// data. Allowed: Unicode letters (\p{L}), combining marks (\p{M}), ASCII
// apostrophe, hyphen. Rejects newlines, brackets, quotes, backticks, RTL
// overrides, ZWJ/ZWNJ, NULL bytes, control characters. First-token-only
// (split on whitespace, take [0]). Max 40 characters. Returns null on any
// failure — no salvage, no character stripping.

const FIRST_NAME_ALLOWED = /^[\p{L}\p{M}'-]+$/u;
// Reject any control characters (C0, C1, DEL) in the raw input before trimming.
// This catches leading/embedded newlines, tabs, NULL bytes, etc.
// eslint-disable-next-line no-control-regex
const HAS_CONTROL_CHAR = /[\x00-\x1F\x7F-\x9F]/;
const MAX_LEN = 40;

export function sanitizeFirstName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (HAS_CONTROL_CHAR.test(raw)) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const firstToken = trimmed.split(/\s+/)[0];
  if (firstToken.length === 0 || firstToken.length > MAX_LEN) return null;
  if (!FIRST_NAME_ALLOWED.test(firstToken)) return null;
  return firstToken;
}
