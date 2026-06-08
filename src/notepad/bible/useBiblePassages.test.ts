// @vitest-environment jsdom
// src/notepad/bible/useBiblePassages.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

// Chainable supabase query builder mock. select/like/order return `this`; the
// builder resolves (await) to { data, error }.
// Use vi.hoisted so these refs are available when vi.mock() factory is hoisted.
const { order, like, select, from, getBuilder, setOrderResult } = vi.hoisted(() => {
  const order = vi.fn();
  const like = vi.fn();
  const select = vi.fn();
  const from = vi.fn();

  let orderResult: { data: unknown; error: unknown } = { data: [], error: null };

  const builder: {
    select: typeof select; like: typeof like; order: typeof order;
    then: (r: (v: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
  } = {
    select, like, order,
    then: (resolve) => Promise.resolve(resolve(orderResult)),
  };

  select.mockImplementation(() => builder);
  like.mockImplementation(() => builder);
  order.mockImplementation(() => builder);
  from.mockImplementation(() => builder);

  return {
    order, like, select, from,
    getBuilder: () => builder,
    setOrderResult: (v: { data: unknown; error: unknown }) => { orderResult = v; },
  };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));

import { useBiblePassages } from './useBiblePassages';

beforeEach(() => {
  from.mockClear(); select.mockClear(); like.mockClear(); order.mockClear();
  // re-wire implementations after mockClear (mockClear only clears call history)
  const builder = getBuilder();
  select.mockImplementation(() => builder);
  like.mockImplementation(() => builder);
  order.mockImplementation(() => builder);
  from.mockImplementation(() => builder);
  setOrderResult({ data: [], error: null });
});
afterEach(cleanup);

describe('useBiblePassages', () => {
  it('queries verse rows for a chapter and maps them to {verse,text}', async () => {
    setOrderResult({
      data: [
        { id: 'jhn.10.1', verse_start: 1, text: 'Truly, truly...' },
        { id: 'jhn.10.2', verse_start: 2, text: 'But he who enters...' },
      ],
      error: null,
    });
    const { result } = renderHook(() => useBiblePassages('jhn', 10));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(from).toHaveBeenCalledWith('bible_passages');
    expect(like).toHaveBeenCalledWith('id', 'jhn.10.%');
    expect(order).toHaveBeenCalledWith('verse_start', { ascending: true });
    expect(result.current.verses).toEqual([
      { verse: 1, text: 'Truly, truly...' },
      { verse: 2, text: 'But he who enters...' },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a query error and empties verses', async () => {
    setOrderResult({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useBiblePassages('jhn', 10));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.verses).toEqual([]);
    expect(result.current.error).toBe('boom');
  });
});
