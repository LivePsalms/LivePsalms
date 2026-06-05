import { describe, it, expect } from 'vitest';
import { runDailyDevotionPipeline, type DailyDevotionContext } from './daily-devotion-pipeline';
import type { LLMAdapter, GenerateOutput } from '../_shared/anthropic';
import type { DailyDevotion } from '../_shared/artifacts';

function makeCtx(overrides: Partial<DailyDevotionContext> = {}): DailyDevotionContext {
  return {
    notes: [{ id: 'note-1', title: 'On rest', plaintext: 'I have been weary lately.' }],
    passages: [{
      source_id: 'psa.23.4',
      text: 'Even though I walk through the valley of the shadow of death…',
      ref: 'Psalm 23:4',
      metadata: { book: 'Psalm', chapter: 23 },
    }],
    localDate: '2026-05-27',
    firstName: null,
    allowedNoteIds: new Set(['note-1']),
    allowedVerseRefs: new Set(['Psalm 23:4']),
    rerankUsed: false,
    ...overrides,
  };
}

function makeAdapter<T>(responses: T[]): LLMAdapter {
  let i = 0;
  return {
    async generate<U>(): Promise<GenerateOutput<U>> {
      const parsed = responses[Math.min(i, responses.length - 1)] as unknown as U;
      i++;
      return { parsed, modelUsed: 'claude-sonnet-4-6', promptTokens: 10, completionTokens: 20 };
    },
  };
}

const cleanArtifact: DailyDevotion = {
  opening: 'A quiet greeting. Welcome back; the lamp is lit and the day is yours.',
  scripture: { ref: 'Psalm 23:4', text: 'Even though I walk through the valley of the shadow of death…' },
  reflection: 'This passage may speak to weariness. The shepherd does not pull the weary forward but walks beside them through the valley. Scripture suggests that fear, in this verse, is not banished but accompanied. For someone walking through what you have described, this verse often becomes less a promise to be fearless than an invitation to be unalone. The rod and the staff are not weapons against your weariness — they are signs that you have not been left.',
  prompt: 'What part of being accompanied through the valley reaches you today?',
  note_citations: [{ note_id: 'note-1', reason: 'recurring weariness across recent notes' }],
};

function makeSupabaseMock(opts: {
  existing?: DailyDevotion | null;
  insertedId?: string;
  insertError?: { code?: string; message: string } | null;
} = {}) {
  const existing = opts.existing ?? null;
  const insertedId = opts.insertedId ?? 'artifact-1';
  const insertError = opts.insertError ?? null;
  const inserts: Array<Record<string, unknown>> = [];
  const usageInserts: Array<Record<string, unknown>> = [];
  const supabase = {
    from(table: string) {
      if (table === 'lamplight_usage') {
        return {
          insert: (row: Record<string, unknown>) => {
            usageInserts.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                async maybeSingle() {
                  if (existing) {
                    return { data: { id: 'cached-id', body: existing, model_used: 'claude-sonnet-4-6', prompt_version: 'daily-devotion-2026-05-27-v1' }, error: null };
                  }
                  return { data: null, error: null };
                },
                async single() {
                  if (existing) {
                    return { data: { id: 'cached-id', body: existing, model_used: 'claude-sonnet-4-6', prompt_version: 'daily-devotion-2026-05-27-v1' }, error: null };
                  }
                  return { data: null, error: { message: 'no row' } };
                },
              }),
            }),
          }),
        }),
        insert: (row: Record<string, unknown>) => {
          inserts.push(row);
          return {
            select: () => ({
              async single() {
                if (insertError) return { data: null, error: insertError };
                return { data: { id: insertedId }, error: null };
              },
            }),
          };
        },
      };
    },
  };
  return { supabase: supabase as unknown as Parameters<typeof runDailyDevotionPipeline>[0]['supabase'], inserts, usageInserts };
}

describe('runDailyDevotionPipeline', () => {
  it('idempotency: returns cached artifact when one already exists, no LLM call', async () => {
    const { supabase, inserts } = makeSupabaseMock({ existing: cleanArtifact });
    let llmCalls = 0;
    const llm: LLMAdapter = {
      async generate<U>(): Promise<GenerateOutput<U>> {
        llmCalls++;
        return { parsed: cleanArtifact as unknown as U, modelUsed: 'm', promptTokens: 0, completionTokens: 0 };
      },
    };
    const result = await runDailyDevotionPipeline({
      llm,
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cached).toBe(true);
      expect(result.attempts).toBe(0);
      expect(result.artifact_id).toBe('cached-id');
      expect(result.usage).toBeNull();
    }
    expect(llmCalls).toBe(0);
    expect(inserts).toHaveLength(0);
  });

  it('no_notes: when ctx is null, returns ok:false reason:no_notes with attempts:0, no LLM call', async () => {
    const { supabase, inserts } = makeSupabaseMock();
    let llmCalls = 0;
    const llm: LLMAdapter = {
      async generate<U>(): Promise<GenerateOutput<U>> {
        llmCalls++;
        return { parsed: cleanArtifact as unknown as U, modelUsed: 'm', promptTokens: 0, completionTokens: 0 };
      },
    };
    const result = await runDailyDevotionPipeline({
      llm,
      supabase,
      ctx: null,
      userId: 'user-1',
      localDate: '2026-05-27',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no_notes');
      expect(result.attempts).toBe(0);
    }
    expect(llmCalls).toBe(0);
    expect(inserts).toHaveLength(0);
  });

  it('happy path: generates, validates, persists, returns ok with artifact_id', async () => {
    const { supabase, inserts, usageInserts } = makeSupabaseMock();
    const result = await runDailyDevotionPipeline({
      llm: makeAdapter([cleanArtifact]),
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.artifact_id).toBe('artifact-1');
      expect(result.attempts).toBe(1);
      expect(result.cached).toBe(false);
      expect(result.artifact.scripture.ref).toBe('Psalm 23:4');
      expect(result.usage).toEqual({
        model: 'claude-sonnet-4-6',
        tokens_in: 10,
        tokens_out: 20,
        status: 'ok',
      });
    }
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      user_id: 'user-1',
      type: 'daily_devotion',
      period_key: '2026-05-27',
      source_note_ids: ['note-1'],
      source_verses: ['Psalm 23:4'],
      prompt_version: 'daily-devotion-2026-05-28-v2',
    });
    await Promise.resolve(); // drain any stray microtask
    // The pipeline no longer records usage — the lifecycle (runGeneration) does.
    expect(usageInserts).toHaveLength(0);
  });

  it('composed system prompt: LAMPLIGHT_SYSTEM_FRAGMENT first, artifact stance second, {{local_date}} substituted, stricter suffix only on retry', async () => {
    const dirty: DailyDevotion = {
      ...cleanArtifact,
      scripture: { ref: 'Made Up 1:1', text: 'fake passage' },
    };
    const { supabase } = makeSupabaseMock();
    const capturedSystems: string[] = [];
    const llm: LLMAdapter = {
      async generate<U>(input: Parameters<LLMAdapter['generate']>[0]): Promise<GenerateOutput<U>> {
        capturedSystems.push(input.system);
        const next = capturedSystems.length === 1 ? dirty : cleanArtifact;
        return { parsed: next as unknown as U, modelUsed: 'claude-sonnet-4-6', promptTokens: 1, completionTokens: 1 };
      },
    };
    await runDailyDevotionPipeline({
      llm,
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });

    expect(capturedSystems).toHaveLength(2);
    // Voice fragment composed first.
    expect(capturedSystems[0]).toMatch(/You are Lamplight/);
    expect(capturedSystems[0]).toMatch(/possibility, not pronouncement/);
    // Artifact stance composed second.
    expect(capturedSystems[0]).toMatch(/Write a brief daily devotion/);
    // {{local_date}} substituted, not left as a placeholder.
    expect(capturedSystems[0]).toContain('Today is 2026-05-27.');
    expect(capturedSystems[0]).not.toContain('{{local_date}}');
    // No stricter suffix on first attempt.
    expect(capturedSystems[0]).not.toMatch(/On retry:/);
    // Stricter suffix present on retry.
    expect(capturedSystems[1]).toMatch(/On retry:/);
  });

  it('validator-fail-then-retry: first attempt has unknown verse ref, second is clean, ok:true attempts:2', async () => {
    const dirty: DailyDevotion = {
      ...cleanArtifact,
      scripture: { ref: 'Made Up 1:1', text: 'fake passage' },
    };
    const { supabase, inserts } = makeSupabaseMock();
    const result = await runDailyDevotionPipeline({
      llm: makeAdapter([dirty, cleanArtifact]),
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attempts).toBe(2);
      expect(result.cached).toBe(false);
    }
    expect(inserts).toHaveLength(1);
  });

  it('race: INSERT conflict triggers re-read; returns cached:true with the existing row', async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const supabase = {
      from(table: string) {
        if (table === 'lamplight_usage') {
          return {
            insert: () => Promise.resolve({ error: null }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  async maybeSingle() {
                    return { data: null, error: null };
                  },
                  async single() {
                    return {
                      data: {
                        id: 'race-id',
                        body: cleanArtifact,
                        model_used: 'claude-sonnet-4-6',
                        prompt_version: 'daily-devotion-2026-05-28-v2',
                      },
                      error: null,
                    };
                  },
                }),
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            inserts.push(row);
            return {
              select: () => ({
                async single() {
                  return { data: null, error: { code: '23505', message: 'unique violation' } };
                },
              }),
            };
          },
        };
      },
    } as unknown as Parameters<typeof runDailyDevotionPipeline>[0]['supabase'];

    const result = await runDailyDevotionPipeline({
      llm: makeAdapter([cleanArtifact]),
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cached).toBe(true);
      expect(result.artifact_id).toBe('race-id');
    }
    expect(inserts).toHaveLength(1);
  });

  it('hard-fail: both attempts violate → ok:false validators_failed, no row inserted', async () => {
    const banned: DailyDevotion = {
      ...cleanArtifact,
      reflection: 'God is telling you to forgive him. ' + cleanArtifact.reflection,
    };
    const { supabase, inserts } = makeSupabaseMock();
    const result = await runDailyDevotionPipeline({
      llm: makeAdapter([banned, banned]),
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('validators_failed');
      expect(result.attempts).toBe(2);
      expect(result.violations?.content.some(v => v.family === 'banned')).toBe(true);
      expect(result.usage).toEqual({
        model: 'claude-sonnet-4-6',
        tokens_in: 0,
        tokens_out: 0,
        status: 'error',
        error_code: 'validators_failed',
      });
    }
    expect(inserts).toHaveLength(0);
  });
});
