// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { LamplightAdapter, AdminJobFilters } from '@/notepad/storage/lamplight-adapter';
import { useAdminFailedJobs } from './useAdminFailedJobs';

function makeAdapter(received: AdminJobFilters[]): LamplightAdapter {
  return {
    adminListJobs: vi.fn(async (filters: AdminJobFilters) => {
      received.push(filters);
      return [];
    }),
  } as unknown as LamplightAdapter;
}

// Flush pending microtasks (the async fetch + state updates) under fake timers.
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useAdminFailedJobs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes since at fetch time from sinceDays and is not pinned across refetch', async () => {
    const received: AdminJobFilters[] = [];
    const adapter = makeAdapter(received);

    const t0 = new Date('2026-06-05T00:00:00.000Z');
    vi.setSystemTime(t0);

    const { result } = renderHook(() =>
      useAdminFailedJobs({ adapter, sinceDays: 7 }),
    );

    await flush();
    expect(received.length).toBe(1);

    const expectedFirst = new Date(t0.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    expect(received[0].since).toBe(expectedFirst);
    expect(received[0].status).toEqual(['failed']);

    // Advance the wall clock, then refetch — since must reflect the NEW now,
    // proving it is computed at fetch time and not pinned at mount.
    const t1 = new Date('2026-06-10T12:00:00.000Z');
    vi.setSystemTime(t1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(received.length).toBe(2);

    const expectedSecond = new Date(t1.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    expect(received[1].since).toBe(expectedSecond);
    expect(received[1].since).not.toBe(received[0].since);
    expect(received[1].status).toEqual(['failed']);
  });

  it('maps kind and userSearch through correctly', async () => {
    const received: AdminJobFilters[] = [];
    const adapter = makeAdapter(received);

    vi.setSystemTime(new Date('2026-06-05T00:00:00.000Z'));

    renderHook(() =>
      useAdminFailedJobs({ adapter, sinceDays: 3, kind: 'embed', userSearch: 'a@b.com' }),
    );

    await flush();
    expect(received.length).toBe(1);
    expect(received[0].kind).toEqual(['embed']);
    expect(received[0].userSearch).toBe('a@b.com');
    expect(received[0].status).toEqual(['failed']);
  });

  it('passes undefined for empty kind and userSearch', async () => {
    const received: AdminJobFilters[] = [];
    const adapter = makeAdapter(received);

    vi.setSystemTime(new Date('2026-06-05T00:00:00.000Z'));

    renderHook(() =>
      useAdminFailedJobs({ adapter, sinceDays: 3, kind: '', userSearch: '' }),
    );

    await flush();
    expect(received.length).toBe(1);
    expect(received[0].kind).toBeUndefined();
    expect(received[0].userSearch).toBeUndefined();
  });
});
