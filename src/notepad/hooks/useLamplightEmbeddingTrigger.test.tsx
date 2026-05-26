// @vitest-environment jsdom
// src/notepad/hooks/useLamplightEmbeddingTrigger.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLamplightEmbeddingTrigger, type InvokeFn } from './useLamplightEmbeddingTrigger';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import type { Note } from '../types';

function note(id: string, content: string): Note {
  return { id, content, title: 't', folderId: null, tags: [], type: 'devotion', createdAt: '', updatedAt: '', wordCount: 0 } as never;
}

const docWithText = (txt: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: txt }] }] });

describe('useLamplightEmbeddingTrigger', () => {
  let adapter: FakeLamplightAdapter;
  let invokeMock: ReturnType<typeof vi.fn> & { mock: { calls: unknown[][] } };

  beforeEach(() => {
    adapter = new FakeLamplightAdapter();
    invokeMock = vi.fn(async () => ({ data: null, error: null }));
  });

  it('does nothing when settings.enabled is false', async () => {
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: false, userId: 'u1', invoke: invokeMock as unknown as InvokeFn,
    }));
    await result.current(note('n1', docWithText('hi')));
    expect(adapter.enqueueCalls).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('does nothing when userId is null', async () => {
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: true, userId: null, invoke: invokeMock as unknown as InvokeFn,
    }));
    await result.current(note('n1', docWithText('hi')));
    expect(adapter.enqueueCalls).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('skips notes whose plaintext is empty', async () => {
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: true, userId: 'u1', invoke: invokeMock as unknown as InvokeFn,
    }));
    await result.current(note('n1', JSON.stringify({ type: 'doc', content: [] })));
    expect(adapter.enqueueCalls).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('enqueues + invokes when text is present and adapter returns a job id', async () => {
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: true, userId: 'u1', invoke: invokeMock as unknown as InvokeFn,
    }));
    await result.current(note('n1', docWithText('hello world')));
    expect(adapter.enqueueCalls.length).toBe(1);
    expect(adapter.enqueueCalls[0].noteId).toBe('n1');
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });
    expect(invokeMock.mock.calls[0][0]).toBe('embed-note');
    expect(invokeMock.mock.calls[0][1]).toMatchObject({ body: { job_id: expect.stringMatching(/^job-n1-/) } });
  });

  it('does not invoke when RPC returns null (no-op enqueue)', async () => {
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: true, userId: 'u1', invoke: invokeMock as unknown as InvokeFn,
    }));
    await result.current(note('n1', docWithText('hello')));
    await result.current(note('n1', docWithText('hello'))); // same hash → RPC returns null
    expect(adapter.enqueueCalls.length).toBe(2);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
  });

  it('swallows invoke errors (cron will pick up the job)', async () => {
    const erroringInvoke = vi.fn(async () => { throw new Error('network'); });
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: true, userId: 'u1', invoke: erroringInvoke as unknown as InvokeFn,
    }));
    await expect(result.current(note('n1', docWithText('x')))).resolves.not.toThrow();
  });

  it('swallows adapter.enqueueEmbedding errors', async () => {
    const errAdapter = new FakeLamplightAdapter();
    errAdapter.enqueueEmbedding = vi.fn(async () => { throw new Error('rpc fail'); }) as never;
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter: errAdapter, enabled: true, userId: 'u1', invoke: invokeMock as unknown as InvokeFn,
    }));
    await expect(result.current(note('n1', docWithText('x')))).resolves.not.toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
