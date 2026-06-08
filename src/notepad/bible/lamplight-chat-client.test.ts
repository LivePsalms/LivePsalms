// src/notepad/bible/lamplight-chat-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sendChatMessage } from './lamplight-chat-client';

describe('sendChatMessage', () => {
  it('invokes lamplight-chat with the passage + message and returns the reply', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { ok: true, thread_id: 't1', reply: 'Grace.', citations: [{ type: 'verse', ref: 'jhn 10:11' }] },
      error: null,
    });
    const out = await sendChatMessage(invoke, { book: 'jhn', chapter: 10, message: 'hi' });
    expect(invoke).toHaveBeenCalledWith('lamplight-chat', { body: { book: 'jhn', chapter: 10, message: 'hi' } });
    expect(out).toEqual({ ok: true, threadId: 't1', reply: 'Grace.', citations: [{ type: 'verse', ref: 'jhn 10:11' }] });
  });

  it('maps a function transport error to ok:false', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { message: 'network' } });
    const out = await sendChatMessage(invoke, { book: 'jhn', chapter: 10, message: 'hi' });
    expect(out).toEqual({ ok: false, reason: 'network' });
  });

  it('passes through a server ok:false reason (e.g. no_entitlement)', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: false, reason: 'no_entitlement' }, error: null });
    const out = await sendChatMessage(invoke, { book: 'jhn', chapter: 10, message: 'hi' });
    expect(out).toEqual({ ok: false, reason: 'no_entitlement' });
  });
});
