import { useEffect, useRef, useState, useCallback } from 'react';
import type { LamplightAdapter } from '../storage/lamplight-adapter';
import type { DailyDevotion } from '../storage/lamplight-artifacts';

export type TodaysLampState =
  | { phase: 'loading'; loadingStep: 0 | 1 | 2 }
  | { phase: 'ready'; artifact: DailyDevotion }
  | { phase: 'error'; reason: 'no_notes' | 'validators_failed' | 'network' };

export interface UseTodaysLampArgs {
  adapter: LamplightAdapter;
  userId: string;
  localDate: string;
  loadingStepIntervalMs?: number;
}

export interface UseTodaysLampResult {
  state: TodaysLampState;
  retry: () => void;
}

export function useTodaysLamp(args: UseTodaysLampArgs): UseTodaysLampResult {
  const { adapter, userId, localDate, loadingStepIntervalMs = 2500 } = args;
  const [state, setState] = useState<TodaysLampState>({ phase: 'loading', loadingStep: 0 });
  const [generation, setGeneration] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    const myGen = generation;
    let step: 0 | 1 | 2 = 0;
    setState({ phase: 'loading', loadingStep: 0 });

    const interval = setInterval(() => {
      if (cancelledRef.current) return;
      step = (Math.min(step + 1, 2) as 0 | 1 | 2);
      setState(prev => prev.phase === 'loading' ? { phase: 'loading', loadingStep: step } : prev);
    }, loadingStepIntervalMs);

    (async () => {
      try {
        const existing = await adapter.getDailyDevotion(userId, localDate);
        if (cancelledRef.current || myGen !== generation) return;
        if (existing) {
          clearInterval(interval);
          setState({ phase: 'ready', artifact: existing });
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
  }, [adapter, userId, localDate, loadingStepIntervalMs, generation]);

  const retry = useCallback(() => {
    setGeneration(g => g + 1);
  }, []);

  return { state, retry };
}
