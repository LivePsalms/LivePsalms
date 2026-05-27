// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTodaysLamp } from './useTodaysLamp';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import type { DailyDevotion } from '../storage/lamplight-artifacts';

const devotion: DailyDevotion = {
  opening: 'op',
  scripture: { ref: 'Psalm 23:4', text: 't' },
  reflection: 'r',
  prompt: 'p',
  note_citations: [{ note_id: 'n1', reason: 'rest' }],
};

describe('useTodaysLamp', () => {
  it('renders existing artifact without invoking generate', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedDailyDevotion('user-1', '2026-05-27', devotion);
    const generateSpy = vi.spyOn(adapter, 'generateDailyDevotion');
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27' }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    if (result.current.state.phase === 'ready') {
      expect(result.current.state.artifact).toEqual(devotion);
    }
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('generates when no existing artifact, transitions through loading to ready', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: true, artifact: devotion, cached: false });
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', loadingStepIntervalMs: 10 }),
    );
    expect(result.current.state.phase).toBe('loading');
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    if (result.current.state.phase === 'ready') {
      expect(result.current.state.artifact).toEqual(devotion);
    }
  });

  it('advances loadingStep on the configured interval', async () => {
    vi.useFakeTimers();
    const adapter = new FakeLamplightAdapter();
    adapter.generateDailyDevotion = (() => new Promise(() => {})) as typeof adapter.generateDailyDevotion;
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', loadingStepIntervalMs: 1000 }),
    );
    if (result.current.state.phase !== 'loading') throw new Error('expected loading');
    expect(result.current.state.loadingStep).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    if (result.current.state.phase !== 'loading') throw new Error('expected loading');
    expect(result.current.state.loadingStep).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    if (result.current.state.phase !== 'loading') throw new Error('expected loading');
    expect(result.current.state.loadingStep).toBe(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    if (result.current.state.phase !== 'loading') throw new Error('expected loading');
    expect(result.current.state.loadingStep).toBe(2);
    vi.useRealTimers();
  });

  it('transitions to error state with reason on failure', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: false, reason: 'validators_failed' });
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', loadingStepIntervalMs: 10 }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    if (result.current.state.phase === 'error') {
      expect(result.current.state.reason).toBe('validators_failed');
    }
  });

  it('retry re-runs the fetch-or-generate flow', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: false, reason: 'network' });
    adapter.__queueGenerateResult({ ok: true, artifact: devotion, cached: false });
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', loadingStepIntervalMs: 10 }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    act(() => { result.current.retry(); });
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  });
});
