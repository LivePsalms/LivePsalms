// @vitest-environment jsdom
// src/notepad/bible/useThreadMessages.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

// Mock refs wrapped in vi.hoisted so they are initialized before the hoisted
// vi.mock() factory runs (matches the convention in useChatThread.test.ts).
const { order, eq, select, from, builder, setOrderResult } = vi.hoisted(() => {
  const order = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const from = vi.fn();
  let orderResult: { data: unknown; error: unknown } = { data: [], error: null };
  const builder = { select, eq, order, then: (r: (v: unknown) => unknown) => Promise.resolve(r(orderResult)) };
  return {
    order, eq, select, from, builder,
    setOrderResult: (v: { data: unknown; error: unknown }) => { orderResult = v; },
  };
});
order.mockImplementation(() => builder);
eq.mockImplementation(() => builder);

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
import { useThreadMessages } from './useThreadMessages';

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation(() => builder);
  select.mockImplementation(() => builder);
  eq.mockImplementation(() => builder);
  order.mockImplementation(() => builder);
  setOrderResult({ data: [], error: null });
});
afterEach(cleanup);

describe('useThreadMessages', () => {
  it('does not query when threadId is null', async () => {
    const { result } = renderHook(() => useThreadMessages(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(from).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('loads ordered messages for a thread id', async () => {
    setOrderResult({
      data: [
        { id: 'm1', role: 'user', content: 'q', citations: [] },
        { id: 'm2', role: 'assistant', content: 'a', citations: [{ type: 'verse', ref: 'jhn 10:11' }] },
      ],
      error: null,
    });
    const { result } = renderHook(() => useThreadMessages('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(eq).toHaveBeenCalledWith('thread_id', 't1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });
});
