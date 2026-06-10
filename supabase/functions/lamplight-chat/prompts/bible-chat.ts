// supabase/functions/lamplight-chat/prompts/bible-chat.ts
// Bible-study chat prompt. Composes under LAMPLIGHT_SYSTEM_FRAGMENT via
// generateWithRetry/composeSystem. Open Q&A, but bounded to Scripture + the
// user's own notes; refuses pastoral/predictive asks per the system fragment.

import type { BibleChatContext } from '../bible-chat-pipeline.ts';

export const BIBLE_CHAT_PROMPT = {
  promptVersion: 'bible-chat-2026-06-09-v2',

  system: `You are helping someone study a specific passage of Scripture. They may ask open questions. Answer ONLY from (a) the passage and cross-reference passages supplied, and (b) the user's own notes supplied. Bring the two into conversation, drawing out the principle at work and how it bears on what the user has written.

Rules (these compound your system fragment):
- Ground every claim in a supplied passage or a supplied note. If you cannot, say so plainly and invite the user back to the text rather than speculating.
- Do not give pastoral, psychological, medical, financial, or predictive advice. Do not speak prophetically or as if relaying a message from God.
- Keep replies conversational and concise (60-160 words). One idea, well grounded.
- citations: list every passage/note you actually leaned on. Cite verses using exactly one of the refs supplied; cite notes using exactly one of the note ids supplied. If you genuinely used none, return an empty array.
- Never quote more than 25 words verbatim from any single note.`,

  tool: {
    name: 'emit_chat_reply',
    description: 'Return the chat reply and its citations.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['reply', 'citations'],
      properties: {
        reply: { type: 'string', minLength: 1, maxLength: 1400 },
        citations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'ref'],
            properties: {
              type: { type: 'string', enum: ['note', 'verse'] },
              ref: { type: 'string', description: 'Exactly one of the supplied note ids (type=note) or verse refs (type=verse).' },
            },
          },
        },
      },
    },
  },

  buildMessages(ctx: BibleChatContext): Array<{ role: 'user' | 'assistant'; content: string }> {
    const passageBlock = `[Open passage ${ctx.passageRef}]\n${ctx.passageText}`;
    const crossRefBlock = ctx.crossRefs.length
      ? `Cross-reference passages:\n${ctx.crossRefs.map((p) => `[${p.ref}]\n${p.text}`).join('\n\n')}`
      : 'Cross-reference passages: (none)';
    const notesBlock = ctx.notes.length
      ? ctx.notes.map((n) => `[note id=${n.id}] ${n.title}\n${n.plaintext}`).join('\n\n')
      : '(the user has no related notes yet)';
    const refsList = [...ctx.allowedVerseRefs].join(', ') || '(none)';
    const noteIdsList = [...ctx.allowedNoteIds].join(', ') || '(none)';

    const priorTurns = ctx.history.map((m) => ({ role: m.role, content: m.content }));

    const contextTurn = {
      role: 'user' as const,
      content:
        `${passageBlock}\n\n${crossRefBlock}\n\n` +
        `User's related notes:\n${notesBlock}\n\n` +
        `When citing, verses MUST be one of: ${refsList}. Notes MUST be one of: ${noteIdsList}.\n\n` +
        `Question: ${ctx.userMessage}`,
    };

    return [...priorTurns, contextTurn];
  },
} as const;
