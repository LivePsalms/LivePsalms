// Throwaway prompt for sub-project 3 — exercises every pipeline stage end-to-end.
// NOT a draft of Today's Lamp. Sub-project 4 writes the real, doctrinal-reviewed
// template; this one is deliberately generic and unimpressive.

import type { SmokeTestContext } from '../pipeline.ts';

export const SMOKE_TEST_PROMPT = {
  promptVersion: 'smoke-test-2026-05-26-v1',

  system: `Produce a brief reflection (≤ 200 words total) that surfaces what Scripture says in light of the user's recent notes. Use the supplied passages only; do not invent references. Cite at least one passage in every section.`,

  tool: {
    name: 'emit_smoke_artifact',
    description: 'Return the smoke-test artifact JSON.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['opening', 'sections'],
      properties: {
        opening: { type: 'string', minLength: 1, maxLength: 400 },
        sections: {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['heading', 'body', 'citations'],
            properties: {
              heading: { type: 'string', minLength: 1, maxLength: 120 },
              body: { type: 'string', minLength: 1, maxLength: 800 },
              citations: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['type', 'ref'],
                  properties: {
                    type: { type: 'string', enum: ['note', 'verse'] },
                    ref: {
                      type: 'string',
                      description: 'For verses, use the exact human-readable form supplied in the user prompt (e.g. "Psalm 23:4", "Romans 8:28-30"). For notes, use the note id.',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  buildMessages(ctx: SmokeTestContext): Array<{ role: 'user'; content: string }> {
    const notesBlock = ctx.notes.map(n => `[note id=${n.id}] ${n.title}\n${n.plaintext}`).join('\n\n');
    const passagesBlock = ctx.passages.map(p => `[${p.ref}] ${p.text}`).join('\n\n');
    return [{
      role: 'user',
      content: `User recent notes:\n${notesBlock}\n\nRetrieved passages:\n${passagesBlock}\n\nReflect briefly. Cite passages using these exact refs: ${[...ctx.allowedVerseRefs].join(', ')}.`,
    }];
  },
} as const;
