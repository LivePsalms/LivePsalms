// Today's Lamp pipeline. Persists to lamplight_artifacts on success;
// idempotent on (user_id, 'daily_devotion', local_date). The retry, no_notes,
// race-handling branches are added in subsequent tasks.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMAdapter } from '../_shared/anthropic.ts';
import type { DailyDevotion } from '../_shared/artifacts.ts';
import {
  BANNED_PHRASES,
  CONTESTED_PASSAGES,
  GROWTH_BANNED_PHRASES,
} from '../_shared/voice.ts';
import {
  validateDailyDevotionCitations,
  applyContentRules,
  applyNameRules,
  flattenDailyDevotionText,
  formatContentFamilyStricter,
  type CitationViolation,
  type ContentRuleViolation,
} from '../_shared/validators.ts';
import { generateWithRetry } from '../_shared/generate-with-retry.ts';
import { DAILY_DEVOTION_PROMPT } from './prompts/daily-devotion.ts';
import type { UsageCore } from '../_shared/usage.ts';

export interface DailyDevotionPassage {
  source_id: string;
  text: string;
  ref: string;
  metadata: Record<string, unknown>;
}

export interface DailyDevotionContext {
  notes: Array<{ id: string; title: string; plaintext: string }>;
  passages: DailyDevotionPassage[];
  localDate: string;
  firstName: string | null;  // sanitizeFirstName(profiles.full_name)
  allowedNoteIds: Set<string>;
  allowedVerseRefs: Set<string>;
  rerankUsed: boolean;
}

export type DailyDevotionPipelineResult =
  | {
      ok: true;
      artifact: DailyDevotion;
      artifact_id: string;
      model_used: string;
      prompt_version: string;
      attempts: number;
      cached: boolean;
      usage: UsageCore | null;
      retrieval?: { note_neighbors: number; bible_passages: number; reranked: boolean };
    }
  | {
      ok: false;
      reason: 'no_notes' | 'validators_failed';
      violations?: { citation: CitationViolation[]; content: ContentRuleViolation[] };
      model_used?: string;
      prompt_version: string;
      attempts: number;
      usage: UsageCore | null;
    };

export async function runDailyDevotionPipeline(args: {
  llm: LLMAdapter;
  supabase: SupabaseClient;
  ctx: DailyDevotionContext | null;
  userId: string;
  localDate: string;
}): Promise<DailyDevotionPipelineResult> {
  const promptVersion = DAILY_DEVOTION_PROMPT.promptVersion;

  // Idempotency: short-circuit if (user, type, period_key) already exists.
  const existing = await args.supabase
    .from('lamplight_artifacts')
    .select('id, body, model_used, prompt_version')
    .eq('user_id', args.userId)
    .eq('type', 'daily_devotion')
    .eq('period_key', args.localDate)
    .maybeSingle();
  if (existing.data) {
    return {
      ok: true,
      artifact: existing.data.body as DailyDevotion,
      artifact_id: existing.data.id as string,
      model_used: (existing.data.model_used as string) ?? 'claude-sonnet-4-6',
      prompt_version: (existing.data.prompt_version as string) ?? promptVersion,
      attempts: 0,
      cached: true,
      usage: null,
    };
  }

  if (!args.ctx) {
    return { ok: false, reason: 'no_notes', prompt_version: promptVersion, attempts: 0, usage: null };
  }
  const ctx = args.ctx;

  const outcome = await generateWithRetry<DailyDevotion, DailyViolations>({
    llm: args.llm,
    model: 'sonnet',
    maxTokens: 2048,
    artifactSystem: DAILY_DEVOTION_PROMPT.system,
    systemTokens: { local_date: ctx.localDate },
    messages: DAILY_DEVOTION_PROMPT.buildMessages(ctx),
    // `as const` on the nested schema produces literal types narrower than
    // ToolSchema.input_schema (Record<string, unknown>); cast is type-only.
    tool: DAILY_DEVOTION_PROMPT.tool as unknown as Parameters<LLMAdapter['generate']>[0]['tool'],
    validate: async (parsed) => {
      const citation = validateDailyDevotionCitations(parsed, {
        allowedNoteIds: ctx.allowedNoteIds,
        allowedVerseRefs: ctx.allowedVerseRefs,
      });
      const content = await applyContentRules(flattenDailyDevotionText(parsed), {
        banned: BANNED_PHRASES,
        contested: CONTESTED_PASSAGES,
        growth: GROWTH_BANNED_PHRASES,
      });
      const nameViolations = applyNameRules({ artifact: parsed, firstName: ctx.firstName });
      return {
        ok: citation.ok && content.ok && nameViolations.length === 0,
        violations: { citation: citation.violations, content: [...content.violations, ...nameViolations] },
      };
    },
    formatStricter: formatStricterSuffix,
  });

  if (!outcome.ok) {
    return {
      ok: false,
      reason: 'validators_failed',
      violations: outcome.violations,
      model_used: outcome.modelUsed,
      prompt_version: promptVersion,
      attempts: outcome.attempts,
      usage: { model: outcome.modelUsed, tokens_in: 0, tokens_out: 0, status: 'error', error_code: 'validators_failed' },
    };
  }

  const { parsed, modelUsed, promptTokens, completionTokens, attempts } = outcome;
  const usageOk: UsageCore = { model: modelUsed, tokens_in: promptTokens, tokens_out: completionTokens, status: 'ok' };

  const sourceNoteIds = parsed.note_citations.map(c => c.note_id);
  const sourceVerses = [parsed.scripture.ref];
  const insertRes = await args.supabase
    .from('lamplight_artifacts')
    .insert({
      user_id: args.userId,
      type: 'daily_devotion',
      period_key: args.localDate,
      title: '',
      body: parsed,
      source_note_ids: sourceNoteIds,
      source_verses: sourceVerses,
      model_used: modelUsed,
      prompt_version: promptVersion,
    })
    .select('id')
    .single();

  if (insertRes.error || !insertRes.data) {
    // Race: another request inserted between our pre-check and this INSERT.
    // Re-read the persisted row and return it as cached.
    const refetch = await args.supabase
      .from('lamplight_artifacts')
      .select('id, body, model_used, prompt_version')
      .eq('user_id', args.userId)
      .eq('type', 'daily_devotion')
      .eq('period_key', args.localDate)
      .single();
    if (refetch.error || !refetch.data) {
      throw insertRes.error ?? refetch.error ?? new Error('insert + re-read both failed');
    }
    return {
      ok: true,
      artifact: refetch.data.body as DailyDevotion,
      artifact_id: refetch.data.id as string,
      model_used: (refetch.data.model_used as string) ?? modelUsed,
      prompt_version: (refetch.data.prompt_version as string) ?? promptVersion,
      attempts,
      cached: true,
      usage: usageOk,
    };
  }

  return {
    ok: true,
    artifact: parsed,
    artifact_id: insertRes.data.id as string,
    model_used: modelUsed,
    prompt_version: promptVersion,
    attempts,
    cached: false,
    usage: usageOk,
    retrieval: {
      note_neighbors: ctx.notes.length,
      bible_passages: ctx.passages.length,
      reranked: ctx.rerankUsed,
    },
  };
}

type DailyViolations = { citation: CitationViolation[]; content: ContentRuleViolation[] };

function formatStricterSuffix(violations: DailyViolations): string {
  const parts: string[] = [];
  if (violations.citation.length > 0) {
    parts.push(
      'On retry: every section MUST cite only refs supplied in the user prompt; note_citations MUST reference only the supplied note ids.',
    );
  }
  parts.push(...formatContentFamilyStricter(violations.content));
  if (violations.content.some(v => v.family === 'name')) {
    parts.push(
      'On retry: use the supplied first name at most twice total across the artifact, never invent or fabricate a salutation, and never combine the name with a Scripture pronouncement.',
    );
  }
  return parts.join(' ');
}
