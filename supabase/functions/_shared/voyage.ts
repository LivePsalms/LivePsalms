// Pure Voyage AI HTTP wrapper. Imported by:
//   - supabase/functions/embed-note (Deno runtime; provides Deno-fetch)
//   - scripts/ingest-bsb.ts (Node runtime; provides global fetch)
//   - vitest tests (mocked fetch).
// No Deno or Node globals here — fetch and sleep are injected via deps.

export type InputType = 'document' | 'query';

const VOYAGE_BASE = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3-large';
const DIM = 1024;
const BATCH_MAX = 64;
const MAX_RETRIES = 3;

export interface VoyageDeps {
  apiKey: string;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function embedDocuments(texts: string[], deps: VoyageDeps): Promise<number[][]> {
  return embedBatched(texts, 'document', deps);
}

export async function embedQuery(text: string, deps: VoyageDeps): Promise<number[]> {
  const [v] = await embedBatched([text], 'query', deps);
  return v;
}

async function embedBatched(
  texts: string[],
  inputType: InputType,
  deps: VoyageDeps,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_MAX) {
    const batch = texts.slice(i, i + BATCH_MAX);
    const vectors = await embedOnce(batch, inputType, deps);
    out.push(...vectors);
  }
  return out;
}

async function embedOnce(
  batch: string[],
  inputType: InputType,
  deps: VoyageDeps,
  attempt = 0,
): Promise<number[][]> {
  const sleep = deps.sleep ?? defaultSleep;
  const res = await deps.fetch(VOYAGE_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deps.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: batch,
      input_type: inputType,
      output_dimension: DIM,
      output_dtype: 'float',
      truncation: true,
    }),
  });

  if (res.ok) {
    const json = await res.json() as { data: Array<{ embedding: number[] }> };
    return json.data.map(d => d.embedding);
  }

  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt < MAX_RETRIES) {
    const backoffMs = 500 * Math.pow(2, attempt) + Math.random() * 250;
    await sleep(backoffMs);
    return embedOnce(batch, inputType, deps, attempt + 1);
  }

  const detail = await res.text().catch(() => '');
  throw new Error(`voyage ${res.status}: ${detail.slice(0, 500)}`);
}

const RERANK_BASE = 'https://api.voyageai.com/v1/rerank';
const RERANK_MODEL = 'rerank-2.5';

export interface RerankResult {
  index: number;
  score: number;
}

export async function rerank(
  query: string,
  documents: string[],
  topK: number,
  deps: VoyageDeps,
): Promise<RerankResult[]> {
  if (documents.length === 0) return [];
  return rerankOnce(query, documents, topK, deps, 0);
}

async function rerankOnce(
  query: string,
  documents: string[],
  topK: number,
  deps: VoyageDeps,
  attempt: number,
): Promise<RerankResult[]> {
  const sleep = deps.sleep ?? defaultSleep;
  const res = await deps.fetch(RERANK_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deps.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query,
      documents,
      top_k: topK,
    }),
  });

  if (res.ok) {
    const json = await res.json() as { data: Array<{ index: number; relevance_score: number }> };
    return json.data.map(d => ({ index: d.index, score: d.relevance_score }));
  }

  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt < MAX_RETRIES) {
    const backoffMs = 500 * Math.pow(2, attempt) + Math.random() * 250;
    await sleep(backoffMs);
    return rerankOnce(query, documents, topK, deps, attempt + 1);
  }

  const detail = await res.text().catch(() => '');
  throw new Error(`voyage rerank ${res.status}: ${detail.slice(0, 500)}`);
}
