import { describe, it, expect, vi } from 'vitest';
import { runBibleChatPipeline, type BibleChatContext } from './bible-chat-pipeline.ts';
import type { LLMAdapter } from '../_shared/anthropic.ts';
import { BIBLE_INSIGHT_PROMPT } from './prompts/bible-insight.ts';

const baseCtx: BibleChatContext = {
  passageRef: 'jhn 10',
  passageText: 'I am the good shepherd...',
  crossRefs: [],
  notes: [{ id: 'note-1', title: 'Psalm 23 study', plaintext: 'rest as trust' }],
  history: [],
  userMessage: 'What does shepherd mean here?',
  allowedNoteIds: new Set(['note-1']),
  allowedVerseRefs: new Set(['jhn 10:11']),
};

function fakeLLM(reply: unknown): LLMAdapter {
  return {
    generate: vi.fn().mockResolvedValue({
      parsed: reply, modelUsed: 'claude-sonnet-4-6', promptTokens: 10, completionTokens: 20,
    }),
  } as unknown as LLMAdapter;
}

describe('runBibleChatPipeline', () => {
  it('returns the validated reply on a clean generation', async () => {
    const llm = fakeLLM({ reply: 'The shepherd lays down his life.', citations: [{ type: 'verse', ref: 'jhn 10:11' }] });
    const out = await runBibleChatPipeline({ llm, ctx: baseCtx });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.reply).toContain('shepherd');
      expect(out.citations).toEqual([{ type: 'verse', ref: 'jhn 10:11' }]);
      expect(out.usage?.status).toBe('ok');
    }
  });

  it('fails after retry when citations never validate', async () => {
    const llm = fakeLLM({ reply: 'x', citations: [{ type: 'verse', ref: 'gen 1:1' }] });
    const out = await runBibleChatPipeline({ llm, ctx: baseCtx });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('validators_failed');
    expect((llm.generate as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2); // one retry
  });

  it('runs with an injected prompt module (insight) and still validates', async () => {
    const llm = fakeLLM({ reply: 'A quiet opening thought on the shepherd.', citations: [{ type: 'verse', ref: 'jhn 10:11' }] });
    const out = await runBibleChatPipeline({ llm, ctx: baseCtx, prompt: BIBLE_INSIGHT_PROMPT });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.promptVersion).toBe(BIBLE_INSIGHT_PROMPT.promptVersion);
  });
});
