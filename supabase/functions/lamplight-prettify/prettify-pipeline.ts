import type { LLMAdapter } from '../_shared/anthropic.ts';
import { generateWithRetry } from '../_shared/generate-with-retry.ts';
import { PRETTIFY_PROMPT } from './prompts/prettify.ts';
import { validatePrettify, type CleanPlan, type Density } from './prettify-validators.ts';
import type { UsageCore } from '../_shared/usage.ts';

export interface PrettifyContext {
  contentText: string;
  density: Density;
}

export type PrettifyPipelineResult =
  | {
      ok: true;
      plan: CleanPlan;
      model_used?: string;
      prompt_version: string;
      attempts: number;
      usage: UsageCore | null;
    }
  | {
      ok: false;
      reason: 'validators_failed';
      model_used?: string;
      prompt_version: string;
      attempts: number;
      usage: UsageCore | null;
    };

type PrettifyViolations = { survived: boolean };

export async function runPrettifyPipeline(args: {
  llm: LLMAdapter;
  ctx: PrettifyContext;
}): Promise<PrettifyPipelineResult> {
  const { llm, ctx } = args;
  const promptVersion = PRETTIFY_PROMPT.promptVersion;

  const outcome = await generateWithRetry<Record<string, unknown>, PrettifyViolations>({
    llm,
    model: 'sonnet',
    maxTokens: 2048,
    artifactSystem: PRETTIFY_PROMPT.system,
    messages: PRETTIFY_PROMPT.buildMessages(ctx),
    tool: PRETTIFY_PROMPT.tool,
    validate: async (parsed) => {
      const { survived } = validatePrettify(parsed, ctx.contentText, ctx.density);
      return { ok: survived, violations: { survived } };
    },
    formatStricter: () =>
      'On retry: every quote MUST be copied verbatim, word-for-word, from the note text — ' +
      'do not paraphrase, re-case, or fix typos. At least one highlight, decoration, or connection ' +
      'must match the note exactly. Respect the density budget.',
  });

  if (!outcome.ok) {
    return {
      ok: false,
      reason: 'validators_failed',
      model_used: outcome.modelUsed,
      prompt_version: promptVersion,
      attempts: outcome.attempts,
      usage: { model: outcome.modelUsed, tokens_in: 0, tokens_out: 0, status: 'error', error_code: 'validators_failed' },
    };
  }

  // Re-run to obtain the clamped/cleaned plan from the accepted raw output.
  const { plan } = validatePrettify(outcome.parsed, ctx.contentText, ctx.density);
  return {
    ok: true,
    plan,
    model_used: outcome.modelUsed,
    prompt_version: promptVersion,
    attempts: outcome.attempts,
    usage: { model: outcome.modelUsed, tokens_in: outcome.promptTokens, tokens_out: outcome.completionTokens, status: 'ok' },
  };
}
