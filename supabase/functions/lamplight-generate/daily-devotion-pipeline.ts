// Today's Lamp pipeline. Persists to lamplight_artifacts on success;
// idempotent on (user_id, 'daily_devotion', local_date). The retry, no_notes,
// race-handling branches are added in subsequent tasks.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMAdapter } from '../_shared/anthropic';
import type { DailyDevotion } from '../_shared/artifacts';
import {
  LAMPLIGHT_SYSTEM_FRAGMENT,
  BANNED_PHRASES,
  CONTESTED_PASSAGES,
  GROWTH_BANNED_PHRASES,
  composeSystem,
} from '../_shared/voice';
import {
  validateDailyDevotionCitations,
  applyContentRules,
  flattenDailyDevotionText,
  type CitationViolation,
  type ContentRuleViolation,
} from '../_shared/validators';
import { DAILY_DEVOTION_PROMPT } from './prompts/daily-devotion';

export interface DailyDevotionPassage {
  source_id: string;
  text: string;
  ref: string;
  metadata: Record<string, unknown>;
}

export interface DailyDevotionContext {
  notes: Array<{ id: string; title: string; plaintext: string }>;
  passages: DailyDevotionPassage[];
  voicePreference: string;
  traditionHint: string;
  localDate: string;
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
      retrieval?: { note_neighbors: number; bible_passages: number; reranked: boolean };
    }
  | {
      ok: false;
      reason: 'no_notes' | 'validators_failed';
      violations?: { citation: CitationViolation[]; content: ContentRuleViolation[] };
      model_used?: string;
      prompt_version: string;
      attempts: number;
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
    };
  }

  if (!args.ctx) {
    return { ok: false, reason: 'no_notes', prompt_version: promptVersion, attempts: 0 };
  }
  const ctx = args.ctx;

  const MAX_ATTEMPTS = 2;
  let attempts = 0;
  let lastViolations: { citation: CitationViolation[]; content: ContentRuleViolation[] } | null = null;
  let lastModelUsed = 'claude-sonnet-4-6';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    attempts++;
    const stricter = attempt === 0 ? '' : formatStricterSuffix(lastViolations!);
    const system = composeSystem({
      base: LAMPLIGHT_SYSTEM_FRAGMENT,
      artifact: DAILY_DEVOTION_PROMPT.system,
      voicePreference: ctx.voicePreference,
      stricter,
      tokens: { local_date: ctx.localDate },
    });

    const { parsed, modelUsed } = await args.llm.generate<DailyDevotion>({
      model: 'sonnet',
      system,
      messages: DAILY_DEVOTION_PROMPT.buildMessages(ctx),
      // `as const` on the nested schema produces literal types narrower than
      // ToolSchema.input_schema (Record<string, unknown>); cast is type-only.
      tool: DAILY_DEVOTION_PROMPT.tool as unknown as Parameters<LLMAdapter['generate']>[0]['tool'],
      maxTokens: 2048,
    });
    lastModelUsed = modelUsed;

    const citation = validateDailyDevotionCitations(parsed, {
      allowedNoteIds: ctx.allowedNoteIds,
      allowedVerseRefs: ctx.allowedVerseRefs,
    });
    const flat = flattenDailyDevotionText(parsed);
    const content = await applyContentRules(flat, {
      banned: BANNED_PHRASES,
      contested: CONTESTED_PASSAGES,
      growth: GROWTH_BANNED_PHRASES,
    });

    if (citation.ok && content.ok) {
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
        retrieval: {
          note_neighbors: ctx.notes.length,
          bible_passages: ctx.passages.length,
          reranked: ctx.rerankUsed,
        },
      };
    }

    lastViolations = { citation: citation.violations, content: content.violations };
  }

  return {
    ok: false,
    reason: 'validators_failed',
    violations: lastViolations!,
    model_used: lastModelUsed,
    prompt_version: promptVersion,
    attempts,
  };
}

function formatStricterSuffix(violations: {
  citation: CitationViolation[];
  content: ContentRuleViolation[];
}): string {
  const parts: string[] = [];
  if (violations.citation.length > 0) {
    parts.push(
      'On retry: every section MUST cite only refs supplied in the user prompt; note_citations MUST reference only the supplied note ids.',
    );
  }
  if (violations.content.length > 0) {
    const families = new Set(violations.content.map(v => v.family));
    if (families.has('banned')) {
      parts.push(
        'On retry: do not produce prophetic, oracular, or "God is telling you" style language. Speak of Scripture in possibility, not pronouncement.',
      );
    }
    if (families.has('contested')) {
      parts.push(
        'On retry: avoid interpreting the contested passages mentioned. Name them gently and defer.',
      );
    }
    if (families.has('growth')) {
      parts.push(
        'On retry: do not use streak / "missed yesterday" / "get back on track" / effort-shaming language.',
      );
    }
  }
  return parts.join(' ');
}
