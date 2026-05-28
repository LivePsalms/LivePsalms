// Connection-why pipeline (sub-project 5). Generate-validate-maybe-retry-once
// with cache-hit short-circuit. Persists the resolved why to
// lamplight_connections on success with the composite content_hash that
// invalidates whenever EITHER note's plaintext changes.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMAdapter } from '../_shared/anthropic.ts';
import {
  applyContentRules,
  flattenConnectionWhyText,
  validateConnectionWhyShape,
  type ConnectionShapeViolation,
  type ConnectionWhyArtifact,
  type ContentRuleViolation,
} from '../_shared/validators.ts';
import {
  BANNED_PHRASES,
  CONTESTED_PASSAGES,
  GROWTH_BANNED_PHRASES,
  LAMPLIGHT_SYSTEM_FRAGMENT,
  composeSystem,
} from '../_shared/voice.ts';
import { CONNECTION_WHY_PROMPT } from './prompts/connection-why.ts';
import { recordLamplightUsage } from '../_shared/usage.ts';

export interface ConnectionWhyContext {
  userId: string;
  source: { id: string; title: string; plaintext: string };
  related: { id: string; title: string; plaintext: string };
  similarity: number;
  voicePreference: string;
  compositeHash: string;
  sharedTags: string[];
  sharedVerseRefs: string[];
}

export type ConnectionWhyPipelineResult =
  | {
      ok: true;
      why: string;
      cached: boolean;
      model_used?: string;
      prompt_version: string;
      attempts: number;
    }
  | {
      ok: false;
      reason: 'validators_failed';
      violations: {
        shape: ConnectionShapeViolation[];
        content: ContentRuleViolation[];
      };
      model_used?: string;
      prompt_version: string;
      attempts: number;
    };

function formatConnectionStricterSuffix(violations: {
  shape: ConnectionShapeViolation[];
  content: ContentRuleViolation[];
}): string {
  const parts: string[] = ['On retry: stay within 24 words; describe, do not advise.'];
  if (violations.shape.some((v) => v.rule === 'word_count_exceeded')) {
    parts.push('Your previous answer was too long — strict word budget is 24.');
  }
  if (violations.content.length > 0) {
    const rules = violations.content.map((v) => v.family).join(', ');
    parts.push(
      `Your previous answer violated: ${rules}. Stay descriptive; no prophetic, contested, or growth-effort phrasing.`,
    );
  }
  return parts.join(' ');
}

export async function runConnectionWhyPipeline(args: {
  llm: LLMAdapter;
  supabase: SupabaseClient;
  ctx: ConnectionWhyContext;
}): Promise<ConnectionWhyPipelineResult> {
  const { ctx, supabase, llm } = args;
  const promptVersion = CONNECTION_WHY_PROMPT.promptVersion;

  // 1. Cache lookup by composite content_hash.
  const { data: cached, error: cErr } = await supabase
    .from('lamplight_connections')
    .select('why, content_hash')
    .eq('note_id', ctx.source.id)
    .eq('related_note_id', ctx.related.id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (cached && cached.content_hash === ctx.compositeHash) {
    return {
      ok: true,
      why: cached.why as string,
      cached: true,
      prompt_version: promptVersion,
      attempts: 0,
    };
  }

  // 2. Generate → validate → maybe-retry-once.
  let attempts = 0;
  let lastViolations:
    | { shape: ConnectionShapeViolation[]; content: ContentRuleViolation[] }
    | null = null;
  let lastModelUsed = 'claude-haiku-4-5-20251001';

  for (let attempt = 0; attempt < 2; attempt++) {
    attempts++;
    const stricter =
      attempt === 0 ? '' : formatConnectionStricterSuffix(lastViolations!);
    const system = composeSystem({
      base: LAMPLIGHT_SYSTEM_FRAGMENT,
      artifact: CONNECTION_WHY_PROMPT.system,
      voicePreference: ctx.voicePreference,
      stricter,
    });

    const { parsed, modelUsed, promptTokens, completionTokens } = await llm.generate<ConnectionWhyArtifact>({
      model: 'haiku',
      system,
      messages: CONNECTION_WHY_PROMPT.buildMessages(ctx),
      tool: CONNECTION_WHY_PROMPT.tool,
      maxTokens: 256,
    });
    lastModelUsed = modelUsed;

    const shape = validateConnectionWhyShape(parsed);
    const flat = flattenConnectionWhyText(parsed);
    const content = await applyContentRules(flat, {
      banned: BANNED_PHRASES,
      contested: CONTESTED_PASSAGES,
      growth: GROWTH_BANNED_PHRASES,
    });

    if (shape.ok && content.ok) {
      const upsertRes = await supabase
        .from('lamplight_connections')
        .upsert(
          {
            note_id: ctx.source.id,
            related_note_id: ctx.related.id,
            why: parsed.why,
            score: ctx.similarity,
            content_hash: ctx.compositeHash,
          },
          { onConflict: 'note_id,related_note_id' },
        );
      if (upsertRes.error) throw upsertRes.error;

      void recordLamplightUsage(supabase, {
        user_id: ctx.userId,
        model: modelUsed,
        artifact_kind: 'connection_card_why',
        tokens_in: promptTokens ?? 0,
        tokens_out: completionTokens ?? 0,
        status: 'ok',
      }).catch(() => {});
      return {
        ok: true,
        why: parsed.why,
        cached: false,
        model_used: modelUsed,
        prompt_version: promptVersion,
        attempts,
      };
    }
    lastViolations = { shape: shape.violations, content: content.violations };
  }

  void recordLamplightUsage(supabase, {
    user_id: ctx.userId,
    model: lastModelUsed,
    artifact_kind: 'connection_card_why',
    tokens_in: 0,
    tokens_out: 0,
    status: 'error',
    error_code: 'validators_failed',
  }).catch(() => {});
  return {
    ok: false,
    reason: 'validators_failed',
    violations: lastViolations!,
    model_used: lastModelUsed,
    prompt_version: promptVersion,
    attempts,
  };
}
