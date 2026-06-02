import { useEffect, useRef, useState, useCallback } from 'react';
import type { LamplightAdapter } from '../storage/lamplight-adapter';
import type { DailyDevotion } from '../storage/lamplight-artifacts';

export type TodaysLampState =
  | { phase: 'idle' }
  | { phase: 'loading'; loadingStep: 0 | 1 | 2 }
  | { phase: 'ready'; artifact: DailyDevotion }
  | { phase: 'error'; reason: 'no_notes' | 'validators_failed' | 'network' };

export interface UseTodaysLampArgs {
  adapter: LamplightAdapter;
  userId: string;
  localDate: string;
  /** When false, a cache miss enters `idle` instead of generating until start() is called. Default true. */
  autoGenerate?: boolean;
  loadingStepIntervalMs?: number;
}

export interface UseTodaysLampResult {
  state: TodaysLampState;
  start: () => void;
  retry: () => void;
}

export function useTodaysLamp(args: UseTodaysLampArgs): UseTodaysLampResult {
  const { adapter, userId, localDate, autoGenerate = true, loadingStepIntervalMs = 2500 } = args;
  const [state, setState] = useState<TodaysLampState>({ phase: 'loading', loadingStep: 0 });
  const [generation, setGeneration] = useState(0);
  const cancelledRef = useRef(false);
  const startRequestedRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    const myGen = generation;
    let step: 0 | 1 | 2 = 0;

    const interval = setInterval(() => {
      if (cancelledRef.current) return;
      step = (Math.min(step + 1, 2) as 0 | 1 | 2);
      setState(prev => prev.phase === 'loading' ? { phase: 'loading', loadingStep: step } : prev);
    }, loadingStepIntervalMs);

    (async () => {
      // Consume the explicit-start request: a start()/retry() applies to
      // exactly the run it triggered and must not leak into later runs caused
      // by prop changes (e.g. the local date rolling over while mounted).
      const startRequested = startRequestedRef.current;
      startRequestedRef.current = false;
      // Reset to loading before each fetch-or-generate run. Done inside the
      // async IIFE so the effect body itself does no synchronous setState.
      setState(prev => prev.phase === 'loading' && prev.loadingStep === 0
        ? prev
        : { phase: 'loading', loadingStep: 0 });
      try {
        const existing = await adapter.getDailyDevotion(userId, localDate);
        if (cancelledRef.current || myGen !== generation) return;
        if (existing) {
          clearInterval(interval);
          setState({ phase: 'ready', artifact: existing });
          return;
        }
        // Cache miss: only generate when auto-generation is on or the user has
        // explicitly asked to start. Otherwise wait in idle for a start() tap.
        const shouldGenerate = autoGenerate || startRequested;
        if (!shouldGenerate) {
          clearInterval(interval);
          setState({ phase: 'idle' });
          return;
        }
        const result = await adapter.generateDailyDevotion(userId, localDate);
        if (cancelledRef.current || myGen !== generation) return;
        clearInterval(interval);
        if (result.ok) {
          setState({ phase: 'ready', artifact: result.artifact });
        } else {
          setState({ phase: 'error', reason: result.reason });
        }
      } catch {
        if (cancelledRef.current || myGen !== generation) return;
        clearInterval(interval);
        setState({ phase: 'error', reason: 'network' });
      }
    })();

    return () => { clearInterval(interval); };
  }, [adapter, userId, localDate, autoGenerate, loadingStepIntervalMs, generation]);

  const start = useCallback(() => {
    startRequestedRef.current = true;
    setGeneration(g => g + 1);
  }, []);

  const retry = useCallback(() => {
    startRequestedRef.current = true;
    setGeneration(g => g + 1);
  }, []);

  return { state, start, retry };
}
