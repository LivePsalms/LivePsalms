// @vitest-environment jsdom
// src/notepad/components/lamplight/chat/LamplightChat.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const useChatThread = vi.fn();
const sendChatMessage = vi.fn();
vi.mock('@/notepad/bible/useChatThread', () => ({ useChatThread: (...a: unknown[]) => useChatThread(...a) }));
vi.mock('@/notepad/bible/lamplight-chat-client', () => ({ sendChatMessage: (...a: unknown[]) => sendChatMessage(...a) }));

import { LamplightChat } from './LamplightChat';

afterEach(cleanup);

function setup(threadOverrides = {}) {
  useChatThread.mockReturnValue({
    messages: [], loading: false, error: null, append: vi.fn(), reload: vi.fn(), ...threadOverrides,
  });
}

describe('LamplightChat', () => {
  it('sends a message and appends the user + assistant turns', async () => {
    const append = vi.fn();
    setup({ append });
    sendChatMessage.mockResolvedValue({ ok: true, threadId: 't1', reply: 'Grace and peace.', citations: [] });
    const invoke = vi.fn();
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={invoke} />);

    fireEvent.change(screen.getByPlaceholderText(/ask about this passage/i), { target: { value: 'what is this about?' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(sendChatMessage).toHaveBeenCalledWith(invoke, { book: 'jhn', chapter: 10, message: 'what is this about?' }));
    await waitFor(() => expect(append).toHaveBeenCalled());
  });

  it('shows an error bubble when the send fails', async () => {
    setup();
    sendChatMessage.mockResolvedValue({ ok: false, reason: 'network' });
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/ask about this passage/i), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/couldn’t reach lamplight|couldn't reach lamplight/i)).toBeInTheDocument());
  });
});
