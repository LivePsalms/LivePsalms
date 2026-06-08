// @vitest-environment jsdom
// src/notepad/components/lamplight/chat/LamplightChat.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const useChatThread = vi.fn();
const sendChatMessage = vi.fn();
const requestOpeningInsight = vi.fn();
vi.mock('@/notepad/bible/useChatThread', () => ({ useChatThread: (...a: unknown[]) => useChatThread(...a) }));
vi.mock('@/notepad/bible/lamplight-chat-client', () => ({
  sendChatMessage: (...a: unknown[]) => sendChatMessage(...a),
  requestOpeningInsight: (...a: unknown[]) => requestOpeningInsight(...a),
}));

import { LamplightChat } from './LamplightChat';

afterEach(cleanup);

beforeEach(() => {
  sendChatMessage.mockReset();
  // Reset call count then set a safe default so the effect doesn't crash when untested.
  requestOpeningInsight.mockReset();
  requestOpeningInsight.mockResolvedValue({ ok: false, reason: 'test-suppressed' });
  useChatThread.mockReset();
});

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
    await waitFor(() => expect(screen.getByText(/reach Lamplight/i)).toBeInTheDocument());
  });
});

describe('LamplightChat opening insight', () => {
  it('auto-fires an insight when the loaded thread is empty', async () => {
    const append = vi.fn();
    useChatThread.mockReturnValue({ messages: [], loading: false, error: null, append, reload: vi.fn() });
    requestOpeningInsight.mockResolvedValue({ ok: true, threadId: 't1', reply: 'Opening thought.', citations: [] });
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);
    await waitFor(() => expect(requestOpeningInsight).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(append).toHaveBeenCalledWith([
      expect.objectContaining({ role: 'assistant', content: 'Opening thought.' }),
    ]));
  });

  it('does NOT fire an insight when the thread already has messages', async () => {
    useChatThread.mockReturnValue({
      messages: [{ id: 'm1', role: 'assistant', content: 'prior', citations: [] }],
      loading: false, error: null, append: vi.fn(), reload: vi.fn(),
    });
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);
    await waitFor(() => expect(requestOpeningInsight).not.toHaveBeenCalled());
  });

  it('does not fire while the thread is still loading', async () => {
    useChatThread.mockReturnValue({ messages: [], loading: true, error: null, append: vi.fn(), reload: vi.fn() });
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);
    await waitFor(() => expect(requestOpeningInsight).not.toHaveBeenCalled());
  });

  it('clears the reflecting indicator when the passage changes mid-insight', async () => {
    requestOpeningInsight.mockReturnValue(new Promise(() => {})); // never resolves: insight stays in-flight
    useChatThread.mockReturnValue({ messages: [], loading: false, error: null, append: vi.fn(), reload: vi.fn() });
    const { rerender } = render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);
    await waitFor(() => expect(requestOpeningInsight).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Lamplight is reflecting/i)).toBeInTheDocument();

    // Switch to a passage that already has messages — the new effect returns early
    // and would never clear `insighting` without the cleanup fix.
    useChatThread.mockReturnValue({
      messages: [{ id: 'm1', role: 'assistant', content: 'prior', citations: [] }],
      loading: false, error: null, append: vi.fn(), reload: vi.fn(),
    });
    rerender(<LamplightChat book="rev" chapter={1} userId="u1" invoke={vi.fn()} />);
    await waitFor(() => expect(screen.queryByText(/Lamplight is reflecting/i)).not.toBeInTheDocument());
  });
});
