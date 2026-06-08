// @vitest-environment jsdom
// src/notepad/bible/useChatThreadList.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

// Mock refs wrapped in vi.hoisted so they are initialized before the hoisted
// vi.mock() factory runs (matches the convention in useChatThread.test.ts).
const { order, eq2, eq1, select, from, builder, setOrderResult } = vi.hoisted(() => {
  const order = vi.fn();
  const eq2 = vi.fn();
  const eq1 = vi.fn();
  const select = vi.fn();
  const from = vi.fn();
  let orderResult: { data: unknown; error: unknown } = { data: [], error: null };
  const builder = { select, eq: eq1, order, then: (r: (v: unknown) => unknown) => Promise.resolve(r(orderResult)) };
  return {
    order, eq2, eq1, select, from, builder,
    setOrderResult: (v: { data: unknown; error: unknown }) => { orderResult = v; },
  };
});
order.mockImplementation(() => builder);
eq1.mockImplementation(() => ({ eq: eq2, order }));
eq2.mockImplementation(() => ({ order }));

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
import { useChatThreadList } from './useChatThreadList';

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation(() => builder);
  select.mockImplementation(() => builder);
  eq1.mockImplementation(() => ({ eq: eq2, order }));
  eq2.mockImplementation(() => ({ order }));
  order.mockImplementation(() => builder);
  setOrderResult({ data: [], error: null });
});
afterEach(cleanup);

describe('useChatThreadList', () => {
  it('returns [] for a passage with no threads', async () => {
    const { result } = renderHook(() => useChatThreadList('jhn', 10, 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.threads).toEqual([]);
    expect(from).toHaveBeenCalledWith('lamplight_chat_threads');
  });

  it('maps thread rows newest-first', async () => {
    setOrderResult({
      data: [
        { id: 't2', title: 'On the gate', created_at: '2026-06-02T00:00:00Z', archived: false },
        { id: 't1', title: 'Study of John 10', created_at: '2026-06-01T00:00:00Z', archived: true },
      ],
      error: null,
    });
    const { result } = renderHook(() => useChatThreadList('jhn', 10, 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.threads.map((t) => t.id)).toEqual(['t2', 't1']);
    expect(result.current.threads[0].archived).toBe(false);
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});
