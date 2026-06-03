// Smoke-test pipeline. Pure function of (LLMAdapter, ctx) — no I/O of its
// own. The HTTP shell (index.ts) builds ctx via buildSmokeTestContext and
// hands it here. Unit-testable by injecting a fake adapter + handcrafted ctx.

import type { LLMAdapter } from '../_shared/anthropic.ts';
import {
  LAMPLIGHT_SYSTEM_FRAGMENT,
  BANNED_PHRASES,
  CONTESTED_PASSAGES,
  GROWTH_BANNED_PHRASES,
  composeSystem,
} from '../_shared/voice.ts';
import {
  validateCitations,
  applyContentRules,
  flattenArtifactText,
  type ArtifactSection,
  type CitationViolation,
  type ContentRuleViolation,
} from '../_shared/validators.ts';
import { SMOKE_TEST_PROMPT } from './prompts/smoke-test.ts';

export interface SmokeTestNote {
  id: string;
  title: string;
  plaintext: string;
}

export interface SmokeTestPassage {
  source_id: string;
  text: string;
  ref: string;
  metadata: Record<string, unknown>;
}

export interface SmokeTestContext {
  notes: SmokeTestNote[];
  passages: SmokeTestPassage[];
  allowedNoteIds: Set<string>;
  allowedVerseRefs: Set<string>;
  rerankUsed: boolean;
}

export interface SmokeTestArtifact {
  opening: string;
  sections: ArtifactSection[];
}

export type PipelineResult =
  | {
      ok: true;
      artifact: SmokeTestArtifact;
      model_used: string;
      prompt_version: string;
      attempts: number;
      retrieval: { note_neighbors: number; bible_passages: number; reranked: boolean };
    }
  | {
      ok: false;
      reason: 'no_notes' | 'validators_failed';
      violations?: { citation: CitationViolation[]; content: ContentRuleViolation[] };
      model_used?: string;
      prompt_version: string;
      attempts: number;
    };

const MAX_ATTEMPTS = 2;

export async function runSmokeTestPipeline(args: {
  llm: LLMAdapter;
  ctx: SmokeTestContext | null;
}): Promise<PipelineResult> {
  const promptVersion = SMOKE_TEST_PROMPT.promptVersion;

  if (!args.ctx) {
    return { ok: false, reason: 'no_notes', prompt_version: promptVersion, attempts: 0 };
  }
  const ctx = args.ctx;

  let attempts = 0;
  let lastViolations: { citation: CitationViolation[]; content: ContentRuleViolation[] } | null = null;
  let lastModelUsed = 'claude-sonnet-4-6';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    attempts++;
    const stricter = attempt === 0 ? '' : formatStricterSuffix(lastViolations!);
    const system = composeSystem({
      base: LAMPLIGHT_SYSTEM_FRAGMENT,
      artifact: SMOKE_TEST_PROMPT.system,
      stricter,
    });

    const { parsed, modelUsed } = await args.llm.generate<SmokeTestArtifact>({
      model: 'sonnet',
      system,
      messages: SMOKE_TEST_PROMPT.buildMessages(ctx),
      tool: SMOKE_TEST_PROMPT.tool,
      maxTokens: 2048,
    });
    lastModelUsed = modelUsed;

    const citation = validateCitations(parsed, {
      allowedNoteIds: ctx.allowedNoteIds,
      allowedVerseRefs: ctx.allowedVerseRefs,
    });
    const flat = flattenArtifactText(parsed);
    const content = await applyContentRules(flat, {
      banned: BANNED_PHRASES,
      contested: CONTESTED_PASSAGES,
      growth: GROWTH_BANNED_PHRASES,
    });

    if (citation.ok && content.ok) {
      return {
        ok: true,
        artifact: parsed,
        model_used: modelUsed,
        prompt_version: promptVersion,
        attempts,
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
      'On retry: every section MUST include at least one entry in citations[], and every cited verse ref MUST match exactly one of the refs supplied in the user prompt.',
    );
  }
  if (violations.content.length > 0) {
    const families = [...new Set(violations.content.map(v => v.family))];
    if (families.includes('banned')) {
      parts.push(
        'On retry: do not produce prophetic, oracular, or "God is telling you" style language. Speak of Scripture in possibility, not pronouncement.',
      );
    }
    if (families.includes('contested')) {
      parts.push(
        'On retry: avoid interpreting the contested passages mentioned. Name them gently and defer.',
      );
    }
    if (families.includes('growth')) {
      parts.push(
        'On retry: do not use streak / "missed yesterday" / "get back on track" / effort-shaming language.',
      );
    }
  }
  return parts.join(' ');
}
