// Coordinator seam for billable Lamplight generation. Wraps a per-kind body
// with the cross-cutting concerns that were previously smeared across index.ts
// and each pipeline: the quota gate, single-site usage recording, and error
// classification. The body returns DATA (a GenerationOutcome), never side
// effects — so this module is node-unit-testable with plain fakes.
//
// What it does NOT own: HTTP/CORS, auth, payload validation, opt-in gating.
// Those stay in the edge function shell (index.ts).

import type { UsageRow, UsageCore } from './usage.ts';

export interface GenerationOutcome {
  response: unknown;
  // The usage to record for this call, or null to record nothing (cache hit,
  // no_notes — a path that incurred no model spend).
  usage: UsageCore | null;
}

export interface GenerationLifecycleDeps {
  checkQuota: (userId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  recordUsage: (row: UsageRow) => Promise<void>;
  classifyError: (err: unknown) => string;
}

export interface GenerationMeta {
  userId: string;
  artifactKind: string;
}

export async function runGeneration(
  deps: GenerationLifecycleDeps,
  meta: GenerationMeta,
  body: () => Promise<GenerationOutcome>,
): Promise<{ status: number; response: unknown }> {
  // Fire-and-forget recording, single site. A usage-table outage must never
  // break the primary work path.
  const record = (core: UsageCore) => {
    void deps
      .recordUsage({ ...core, user_id: meta.userId, artifact_kind: meta.artifactKind })
      .catch(() => {});
  };

  const quota = await deps.checkQuota(meta.userId);
  if (!quota.ok) {
    record({ model: null, tokens_in: 0, tokens_out: 0, status: 'error', error_code: 'quota_exceeded' });
    return { status: 429, response: { error: 'quota_exceeded', reason: quota.reason } };
  }

  try {
    const outcome = await body();
    if (outcome.usage) record(outcome.usage);
    return { status: 200, response: outcome.response };
  } catch (err) {
    record({ model: null, tokens_in: 0, tokens_out: 0, status: 'error', error_code: deps.classifyError(err) });
    throw err;
  }
}
