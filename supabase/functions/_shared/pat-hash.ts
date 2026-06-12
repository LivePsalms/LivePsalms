// supabase/functions/_shared/pat-hash.ts
// SHA-256 hex of a personal access token's raw string. The raw token is shown
// to the user once; only this hash is ever stored or compared. The browser
// (src/auth/personal-tokens.ts) MUST use an identical algorithm so issued
// tokens validate here — the same known-answer vector is asserted in both trees.
export async function hashToken(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
