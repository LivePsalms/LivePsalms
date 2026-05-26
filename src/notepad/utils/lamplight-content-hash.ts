import { sha256 } from 'js-sha256';

// Deterministic content hash used to decide whether a note needs re-embedding.
// MUST stay byte-identical to what the Edge Function computes server-side,
// otherwise we re-embed on every save. The Edge Function uses the Deno
// `crypto.subtle` SHA-256 implementation in `_shared/sha256.ts`.
export function lamplightContentHash(plaintext: string): string {
  return sha256(plaintext);
}
