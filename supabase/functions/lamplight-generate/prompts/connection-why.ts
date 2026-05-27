import type { ConnectionWhyContext } from '../connection-why-pipeline.ts';

export const CONNECTION_WHY_PROMPT_VERSION = 'connection-why-2026-05-27-v1';

export const CONNECTION_WHY_PROMPT = {
  promptVersion: CONNECTION_WHY_PROMPT_VERSION,
  system: [
    "Two of the user's notes share signal. In ≤24 words, name what they share.",
    '',
    'How to write the line:',
    '- Concrete and observable. Name a recurring image, theme, or question that links them.',
    '- Describe — do not advise. No "you should…", no "consider…", no "remember…".',
    '- Quote nothing verbatim from either note. Reference is fine; transcription is not.',
    '- If the shared signal is a Scripture reference, name it gently.',
    '- Mirror the user\'s voice preference for divine names: use "{{voice_preference}}".',
    '',
    "You inherit the voice fragment's prohibitions — no prophetic claims, no streak language,",
    'no interpretation of contested passages beyond plain reading.',
  ].join('\n'),
  tool: {
    name: 'emit_connection_why',
    description: 'Return the one-line connection rationale.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['why'],
      properties: {
        why: { type: 'string', minLength: 8, maxLength: 200 },
      },
    },
  },
  buildMessages(ctx: ConnectionWhyContext): Array<{ role: 'user'; content: string }> {
    const sourceBlock =
      `Active note (id=${ctx.source.id}, title="${ctx.source.title}"):\n` +
      ctx.source.plaintext.slice(0, 1200);
    const relatedBlock =
      `Related note (id=${ctx.related.id}, title="${ctx.related.title}"):\n` +
      ctx.related.plaintext.slice(0, 1200);
    const tagsLine = ctx.sharedTags.length ? ctx.sharedTags.join(', ') : 'none';
    const refsLine = ctx.sharedVerseRefs.length ? ctx.sharedVerseRefs.join(', ') : 'none';
    return [{
      role: 'user',
      content:
        `${sourceBlock}\n\n${relatedBlock}\n\n` +
        `Shared signals — tags: [${tagsLine}]; verse refs: [${refsLine}]; ` +
        `cosine similarity: ${ctx.similarity.toFixed(3)}.\n\n` +
        `Write the connection in ≤24 words.`,
    }];
  },
} as const;
