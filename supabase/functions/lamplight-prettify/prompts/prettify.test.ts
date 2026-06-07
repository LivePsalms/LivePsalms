import { describe, it, expect } from 'vitest';
import { PRETTIFY_PROMPT } from './prettify';

describe('PRETTIFY_PROMPT', () => {
  it('forces a single tool with the spec input_schema', () => {
    expect(PRETTIFY_PROMPT.tool.name).toBe('emit_prettify_plan');
    const props = PRETTIFY_PROMPT.tool.input_schema.properties as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual(
      ['connections', 'decorations', 'highlights', 'summary'],
    );
  });

  it('builds a user message containing the note text and density budget', () => {
    const msgs = PRETTIFY_PROMPT.buildMessages({
      contentText: 'Grace is sufficient. Press on.',
      density: 'balanced',
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toContain('Grace is sufficient. Press on.');
    expect(msgs[0].content.toLowerCase()).toContain('balanced');
  });

  it('instructs verbatim quoting in the system prompt', () => {
    expect(PRETTIFY_PROMPT.system.toLowerCase()).toContain('verbatim');
  });
});
