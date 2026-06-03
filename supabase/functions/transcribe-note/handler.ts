// supabase/functions/transcribe-note/handler.ts
import type { LLMAdapter } from '../_shared/anthropic.ts';
import type { VerseFlag } from '../_shared/verse-verify.ts';
import { TRANSCRIBE_SYSTEM, TRANSCRIBE_TOOL } from './prompt.ts';

export interface UncertainWord { text: string; context?: string }

export interface TranscribeResult {
  transcription: string;
  confidence: number;
  uncertainWords: UncertainWord[];
  verseFlags: VerseFlag[];
  transcription_id: string;
}

export interface TranscribeDeps {
  llm: LLMAdapter;
  downloadImage: (key: string) => Promise<{ base64: string; mimeType: string }>;
  verifyVerseRefs: (supabase: unknown, refs: string[]) => Promise<VerseFlag[]>;
  extractVerseRefs: (text: string) => string[];
  insertRow: (row: Record<string, unknown>) => Promise<string>;
  recordUsage: (row: {
    user_id: string; model: string; artifact_kind: string;
    tokens_in: number; tokens_out: number; status: 'ok' | 'error'; error_code?: string;
  }) => Promise<void>;
  supabase: unknown;
}

export interface TranscribeBody { user_id?: string; image_key?: string }
export interface HandlerResponse { status: number; body: TranscribeResult | { error: string } }

export async function handleTranscribe(
  deps: TranscribeDeps,
  body: TranscribeBody,
): Promise<HandlerResponse> {
  if (typeof body.user_id !== 'string' || body.user_id.length === 0) {
    return { status: 400, body: { error: 'bad user_id' } };
  }
  if (typeof body.image_key !== 'string') {
    return { status: 400, body: { error: 'bad image_key' } };
  }
  // IDOR guard: key must be exactly note-scans/{user_id}/{single-safe-filename}.
  // A plain startsWith() is not path-aware — `..` segments would escape the
  // user's folder, and the service-role client bypasses storage RLS.
  const prefix = `note-scans/${body.user_id}/`;
  const rest = body.image_key.startsWith(prefix) ? body.image_key.slice(prefix.length) : null;
  if (rest === null || !/^[A-Za-z0-9._-]+$/.test(rest)) {
    return { status: 403, body: { error: 'forbidden image_key' } };
  }

  const { base64, mimeType } = await deps.downloadImage(body.image_key);

  let parsed: { transcription: string; confidence: number; uncertainWords: UncertainWord[] };
  let modelUsed = 'claude-sonnet-4-6';
  let tokensIn = 0, tokensOut = 0;
  try {
    const out = await deps.llm.generate<typeof parsed>({
      model: 'sonnet',
      system: TRANSCRIBE_SYSTEM,
      maxTokens: 4096,
      tool: TRANSCRIBE_TOOL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe this handwritten note.' },
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        ],
      }],
    });
    if (!out.parsed || typeof out.parsed !== 'object') {
      throw new Error('empty transcription result');
    }
    parsed = out.parsed;
    modelUsed = out.modelUsed;
    tokensIn = out.promptTokens;
    tokensOut = out.completionTokens;
  } catch (err) {
    await deps.recordUsage({
      user_id: body.user_id, model: modelUsed, artifact_kind: 'note_transcription',
      tokens_in: 0, tokens_out: 0, status: 'error',
      error_code: err instanceof Error ? err.message.slice(0, 80) : 'llm_error',
    });
    return { status: 502, body: { error: 'transcription failed' } };
  }

  const transcription = parsed.transcription ?? '';
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  const uncertainWords = Array.isArray(parsed.uncertainWords) ? parsed.uncertainWords : [];

  let verseFlags: VerseFlag[] = [];
  try {
    const refs = deps.extractVerseRefs(transcription);
    if (refs.length > 0) verseFlags = await deps.verifyVerseRefs(deps.supabase, refs);
  } catch {
    verseFlags = [];
  }

  let transcription_id: string;
  try {
    transcription_id = await deps.insertRow({
      user_id: body.user_id,
      image_key: body.image_key,
      raw_transcription: transcription,
      confidence,
      uncertain_words: uncertainWords,
      verse_flags: verseFlags,
      model: modelUsed,
      status: 'transcribed',
    });
  } catch (err) {
    await deps.recordUsage({
      user_id: body.user_id, model: modelUsed, artifact_kind: 'note_transcription',
      tokens_in: tokensIn, tokens_out: tokensOut, status: 'error',
      error_code: err instanceof Error ? err.message.slice(0, 80) : 'insert_error',
    });
    return { status: 500, body: { error: 'failed to save transcription' } };
  }

  await deps.recordUsage({
    user_id: body.user_id, model: modelUsed, artifact_kind: 'note_transcription',
    tokens_in: tokensIn, tokens_out: tokensOut, status: 'ok',
  });

  return {
    status: 200,
    body: { transcription, confidence, uncertainWords, verseFlags, transcription_id },
  };
}
