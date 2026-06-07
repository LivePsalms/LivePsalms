import { describe, it, expect } from 'vitest';
import { runPrettifyPipeline } from './prettify-pipeline';
import type { LLMAdapter, GenerateOutput } from '../_shared/anthropic';

const CONTENT = 'Grace is sufficient. The thorn remains.';

function makeLLM(responses: unknown[], capturedSystems: string[] = []): LLMAdapter {
  let i = 0;
  return {
    async generate<T>(input: { system: string }): Promise<GenerateOutput<T>> {
      capturedSystems.push(input.system);
      const r = responses[i++];
      if (r === undefined) throw new Error('no more LLM responses');
      return { parsed: r as T, modelUsed: 'claude-sonnet-4-6', promptTokens: 200, completionTokens: 80 };
    },
  } as LLMAdapter;
}

describe('runPrettifyPipeline', () => {
  it('returns a clamped plan and ok usage on a valid generation', async () => {
    const llm = makeLLM([{
      summary: 'ok',
      highlights: [{ quote: 'Grace is sufficient', role: 'key-point' }],
      decorations: [{ quote: 'The thorn remains', kind: 'underline' }],
      connections: [],
    }]);
    const result = await runPrettifyPipeline({ llm, ctx: { contentText: CONTENT, density: 'balanced' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.highlights).toHaveLength(1);
      expect(result.plan.decorations).toHaveLength(1);
      expect(result.attempts).toBe(1);
      expect(result.usage).toEqual({
        model: 'claude-sonnet-4-6', tokens_in: 200, tokens_out: 80, status: 'ok',
      });
    }
  });

  it('retries when nothing survives, then succeeds', async () => {
    const llm = makeLLM([
      { summary: '', highlights: [{ quote: 'paraphrase only', role: 'key-point' }], decorations: [], connections: [] },
      { summary: '', highlights: [{ quote: 'Grace is sufficient', role: 'key-point' }], decorations: [], connections: [] },
    ]);
    const result = await runPrettifyPipeline({ llm, ctx: { contentText: CONTENT, density: 'balanced' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.attempts).toBe(2);
  });

  it('fails with validators_failed when both attempts yield nothing', async () => {
    const empty = { summary: '', highlights: [], decorations: [], connections: [] };
    const llm = makeLLM([empty, empty]);
    const result = await runPrettifyPipeline({ llm, ctx: { contentText: CONTENT, density: 'balanced' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('validators_failed');
      expect(result.attempts).toBe(2);
      expect(result.usage).toEqual({
        model: 'claude-sonnet-4-6', tokens_in: 0, tokens_out: 0, status: 'error', error_code: 'validators_failed',
      });
    }
  });

  it('composes the Lamplight voice fragment into the system prompt', async () => {
    const captured: string[] = [];
    const llm = makeLLM(
      [{ summary: '', highlights: [{ quote: 'Grace is sufficient', role: 'key-point' }], decorations: [], connections: [] }],
      captured,
    );
    await runPrettifyPipeline({ llm, ctx: { contentText: CONTENT, density: 'light' } });
    expect(captured[0]).toContain('Lamplight');
  });
});
