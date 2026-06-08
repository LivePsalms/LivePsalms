// @vitest-environment jsdom
// src/notepad/bible/useChatThread.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

// Mock refs wrapped in vi.hoisted so they are initialized before the hoisted
// vi.mock() factory runs (matches the convention in useBiblePassages.test.ts).
const {
  order, eqMsg, selectMsg, eqThread, selectThread, maybeSingle, from,
  threadBuilder, msgBuilder, setOrderResult,
} = vi.hoisted(() => {
  const order = vi.fn();
  const eqMsg = vi.fn();
  const selectMsg = vi.fn();
  const eqThread = vi.fn();
  const selectThread = vi.fn();
  const maybeSingle = vi.fn();
  const from = vi.fn();

  let orderResult: { data: unknown; error: unknown } = { data: [], error: null };

  const threadBuilder = { select: selectThread, eq: eqThread, maybeSingle };
  const msgBuilder = {
    select: selectMsg, eq: eqMsg, order,
    then: (r: (v: unknown) => unknown) => Promise.resolve(r(orderResult)),
  };

  return {
    order, eqMsg, selectMsg, eqThread, selectThread, maybeSingle, from,
    threadBuilder, msgBuilder,
    setOrderResult: (v: { data: unknown; error: unknown }) => { orderResult = v; },
  };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
import { useChatThread } from './useChatThread';

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation((t: string) => (t === 'lamplight_chat_threads' ? threadBuilder : msgBuilder));
  selectThread.mockImplementation(() => threadBuilder);
  eqThread.mockImplementation(() => threadBuilder);
  selectMsg.mockImplementation(() => msgBuilder);
  eqMsg.mockImplementation(() => msgBuilder);
  order.mockImplementation(() => msgBuilder);
  setOrderResult({ data: [], error: null });
});
afterEach(cleanup);

describe('useChatThread', () => {
  it('returns [] when no thread exists for the passage', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useChatThread('jhn', 10, 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);
  });

  it('loads ordered messages when a thread exists', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 't1' }, error: null });
    setOrderResult({
      data: [
        { id: 'm1', role: 'user', content: 'hi', citations: [] },
        { id: 'm2', role: 'assistant', content: 'grace', citations: [{ type: 'verse', ref: 'jhn 10:11' }] },
      ],
      error: null,
    });
    const { result } = renderHook(() => useChatThread('jhn', 10, 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(eqMsg).toHaveBeenCalledWith('thread_id', 't1');
  });

  it('only loads the active (non-archived) thread', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 't1' }, error: null });
    setOrderResult({ data: [], error: null });
    const { result } = renderHook(() => useChatThread('jhn', 10, 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(eqThread).toHaveBeenCalledWith('archived', false);
  });
});
