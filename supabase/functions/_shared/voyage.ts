// Pure Voyage AI HTTP wrapper. Imported by:
//   - supabase/functions/embed-note (Deno runtime; provides Deno-fetch)
//   - scripts/ingest-bsb.ts (Node runtime; provides global fetch)
//   - vitest tests (mocked fetch).
// No Deno or Node globals here — fetch and sleep are injected via deps.

export type InputType = 'document' | 'query';

const ENDPOINT = 'https://api.voyageai.com/v1/contextualizedembeddings';
export const MODEL = 'voyage-context-3';
export const DIM = 512;
const MAX_DOCS_PER_REQUEST = 64;
const MAX_RETRIES = 3;

export interface VoyageDeps {
  apiKey: string;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface EmbedDocumentsResult {
  // Outer index = document, inner index = chunk-within-document.
  vectors: number[][][];
  totalTokens: number;
}

export async function embedDocuments(
  chunksPerDoc: string[][],
  deps: VoyageDeps,
): Promise<EmbedDocumentsResult> {
  return embedBatched(chunksPerDoc, 'document', deps);
}

export async function embedQuery(text: string, deps: VoyageDeps): Promise<number[]> {
  const { vectors } = await embedBatched([[text]], 'query', deps);
  return vectors[0][0];
}

async function embedBatched(
  chunksPerDoc: string[][],
  inputType: InputType,
  deps: VoyageDeps,
): Promise<EmbedDocumentsResult> {
  if (chunksPerDoc.length === 0) return { vectors: [], totalTokens: 0 };
  const vectors: number[][][] = [];
  let totalTokens = 0;
  for (let i = 0; i < chunksPerDoc.length; i += MAX_DOCS_PER_REQUEST) {
    const batch = chunksPerDoc.slice(i, i + MAX_DOCS_PER_REQUEST);
    const result = await embedOnce(batch, inputType, deps, 0);
    vectors.push(...result.vectors);
    totalTokens += result.totalTokens;
  }
  return { vectors, totalTokens };
}

async function embedOnce(
  batch: string[][],
  inputType: InputType,
  deps: VoyageDeps,
  attempt: number,
): Promise<EmbedDocumentsResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const res = await deps.fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deps.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      inputs: batch,
      input_type: inputType,
      output_dimension: DIM,
      output_dtype: 'float',
    }),
  });

  if (res.ok) {
    // Real Voyage response shape (object wrappers preserved at every level):
    //   { data: [{ data: [{ embedding: number[], index }], index }], usage }
    const json = await res.json() as {
      data: Array<{ data: Array<{ embedding: number[]; index: number }>; index: number }>;
      usage?: { total_tokens?: number };
    };
    return {
      vectors: json.data.map(doc => doc.data.map(chunk => chunk.embedding)),
      totalTokens: json.usage?.total_tokens ?? 0,
    };
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
