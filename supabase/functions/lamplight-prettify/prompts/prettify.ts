export interface PrettifyPromptContext {
  contentText: string;
  density: 'light' | 'balanced' | 'rich';
}

export const PRETTIFY_PROMPT_VERSION = 'prettify-2026-06-06-v1';

const DENSITY_GUIDANCE: Record<PrettifyPromptContext['density'], string> = {
  light: 'Light: up to 3 key-point highlights, 1 topic/theme highlight, 2 decorations, 1 connection.',
  balanced: 'Balanced: up to 4 key-point highlights, 2 topic/theme highlights, 4 decorations, 2 connections.',
  rich: 'Rich: up to 6 key-point highlights, 4 topic/theme highlights, 8 decorations, 4 connections.',
};

export const PRETTIFY_PROMPT = {
  promptVersion: PRETTIFY_PROMPT_VERSION,
  system: [
    "You decorate the user's own note to make it prettier and easier to study.",
    'You do not rewrite, summarise into, or add text to the note. You only mark up text that is already there.',
    '',
    'Return semantic intents only — never colours, never coordinates:',
    '- highlights: short, meaningful spans. role="key-point" for the load-bearing claim or instruction;',
    '  role="topic" for a recurring subject; role="theme" for an overarching idea.',
    '- decorations: kind="underline" to stress a phrase, kind="bracket" to group a clause,',
    '  kind="margin-arrow" to flag something worth returning to.',
    '- connections: link two spans within the same note that speak to each other.',
    '',
    'Quoting rules (strict):',
    '- Every quote MUST be copied verbatim, word-for-word, from the note. Do not paraphrase, fix typos, or re-case.',
    '- Keep each quote short (a clause or sentence), not whole paragraphs.',
    '- If the same text appears more than once, set "occurrence" (1-based) to disambiguate.',
    '- Prefer fewer, higher-signal marks. Respect the density budget below.',
    '',
    'You inherit the voice fragment\'s prohibitions — no prophetic claims, no streak language,',
    'no interpretation of contested passages beyond plain reading.',
  ].join('\n'),
  tool: {
    name: 'emit_prettify_plan',
    description: 'Return semantic decoration intents for the note.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'highlights', 'decorations', 'connections'],
      properties: {
        summary: { type: 'string', minLength: 0, maxLength: 280 },
        highlights: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['quote', 'role'],
            properties: {
              quote: { type: 'string', minLength: 1, maxLength: 400 },
              occurrence: { type: 'integer', minimum: 1 },
              role: { type: 'string', enum: ['key-point', 'topic', 'theme'] },
            },
          },
        },
        decorations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['quote', 'kind'],
            properties: {
              quote: { type: 'string', minLength: 1, maxLength: 400 },
              occurrence: { type: 'integer', minimum: 1 },
              kind: { type: 'string', enum: ['underline', 'bracket', 'margin-arrow'] },
            },
          },
        },
        connections: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['from_quote', 'to_quote'],
            properties: {
              from_quote: { type: 'string', minLength: 1, maxLength: 400 },
              from_occurrence: { type: 'integer', minimum: 1 },
              to_quote: { type: 'string', minLength: 1, maxLength: 400 },
              to_occurrence: { type: 'integer', minimum: 1 },
            },
          },
        },
      },
    },
  },
  buildMessages(ctx: PrettifyPromptContext): Array<{ role: 'user'; content: string }> {
    return [{
      role: 'user',
      content:
        `Density: ${ctx.density}. ${DENSITY_GUIDANCE[ctx.density]}\n\n` +
        `Note text (decorate spans that appear here, verbatim):\n` +
        '"""\n' +
        ctx.contentText.slice(0, 12000) +
        '\n"""',
    }];
  },
} as const;
