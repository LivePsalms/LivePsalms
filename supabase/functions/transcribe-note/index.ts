// supabase/functions/transcribe-note/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { createAnthropicAdapter } from '../_shared/anthropic.ts';
import { verifyVerseRefs } from '../_shared/verse-verify.ts';
import { extractVerseRefsFromNoteContent } from '../_shared/note-signals.ts';
import { recordLamplightUsage } from '../_shared/usage.ts';
import { handleTranscribe } from './handler.ts';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });

// Prefer the stored blob's content-type; fall back to the key's extension so a
// PNG/WebP isn't mislabeled as JPEG (which Claude would reject).
function mimeFromKey(key: string, blobType: string): string {
  if (blobType && blobType !== 'application/octet-stream') return blobType;
  const ext = key.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

// extractVerseRefsFromNoteContent expects TipTap JSON; wrap plain transcription
// text into a one-paragraph doc so we can reuse the canonical extractor.
function extractVerseRefsFromText(text: string): string[] {
  const doc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
  return extractVerseRefsFromNoteContent(doc);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);
  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) return jsonResp({ error: 'ANTHROPIC_API_KEY missing' }, 500);

    let body: { user_id?: string; image_key?: string };
    try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }

    const supabase = serviceClient();
    const llm = createAnthropicAdapter({ apiKey: anthropicKey, fetch });

    const res = await handleTranscribe({
      llm,
      supabase,
      extractVerseRefs: extractVerseRefsFromText,
      verifyVerseRefs,
      downloadImage: async (key) => {
        const { data, error } = await supabase.storage.from('note-scans').download(key.replace(/^note-scans\//, ''));
        if (error || !data) throw new Error(`download failed: ${error?.message ?? 'no data'}`);
        const buf = new Uint8Array(await data.arrayBuffer());
        return { base64: encodeBase64(buf), mimeType: mimeFromKey(key, data.type) };
      },
      insertRow: async (row) => {
        const { data, error } = await supabase.from('note_transcriptions').insert(row).select('id').single();
        if (error) throw new Error(error.message);
        return data!.id as string;
      },
      recordUsage: (usageRow) => recordLamplightUsage(supabase, usageRow),
    }, body);

    return jsonResp(res.body, res.status);
  } catch (err) {
    return jsonResp({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
