import { sha256 } from 'js-sha256';

// Deterministic content hash used to decide whether a note needs re-embedding.
// The hash is computed client-side and passed to the enqueue_lamplight_embedding
// RPC, which compares it against the stored content_hash on the existing
// lamplight_embeddings row to decide whether a Voyage call is needed.
// The backfill script uses the same js-sha256 implementation against extracted
// plaintext, so client + backfill hashes always agree.
export function lamplightContentHash(plaintext: string): string {
  return sha256(plaintext);
}
