// src/notepad/hooks/useLamplightEmbeddingTrigger.ts
import { useCallback } from 'react';
import type { Note } from '../types';
import type { LamplightAdapter } from '../storage/lamplight-adapter';
import { extractTextFromNote } from '../utils/tiptap-text';
import { lamplightContentHash } from '../utils/lamplight-content-hash';

export interface InvokeFn {
  (functionName: 'embed-note', options: { body: Record<string, unknown> }): Promise<unknown>;
}

export interface UseLamplightEmbeddingTriggerArgs {
  adapter: LamplightAdapter;
  enabled: boolean;
  userId: string | null;
  invoke: InvokeFn;
}

export function useLamplightEmbeddingTrigger({
  adapter, enabled, userId, invoke,
}: UseLamplightEmbeddingTriggerArgs) {
  return useCallback(async (note: Note) => {
    if (!enabled || !userId) return;
    const plaintext = extractTextFromNote(note);
    if (plaintext.trim().length === 0) return;
    const hash = lamplightContentHash(plaintext);
    let jobId: string | null = null;
    try {
      jobId = await adapter.enqueueEmbedding(note.id, hash);
    } catch (err) {
      console.error('[lamplight] enqueueEmbedding failed', err);
      return;
    }
    if (!jobId) return;
    invoke('embed-note', { body: { job_id: jobId } })
      .catch((err) => console.warn('[lamplight] embed-note invoke failed (sweep will retry)', err));
  }, [adapter, enabled, userId, invoke]);
}
