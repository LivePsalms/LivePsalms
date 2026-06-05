import { useMemo, useRef, useSyncExternalStore } from 'react';
import {
  ConnectionWhy,
  type ConnectionWhyDeps,
  type ConnectionCardWhyState,
} from '../connection-cards/connection-why';
import type { LamplightAdapter } from '../storage/lamplight-adapter';

const COLLAPSED: ConnectionCardWhyState = { phase: 'collapsed' };

export interface UseConnectionWhyArgs {
  adapter: LamplightAdapter;
  sourceNoteId: string | null;
}

export interface UseConnectionWhyResult {
  whyState: (relatedNoteId: string) => ConnectionCardWhyState;
  expand: (relatedNoteId: string) => Promise<void>;
  retry: (relatedNoteId: string) => Promise<void>;
}

export function useConnectionWhy({ adapter, sourceNoteId }: UseConnectionWhyArgs): UseConnectionWhyResult {
  // Captured via ref so the controller isn't recreated when the adapter identity churns.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const controller = useMemo(() => {
    const deps: ConnectionWhyDeps = {
      generateConnectionWhy: (src, rel) => adapterRef.current.generateConnectionWhy(src, rel),
    };
    return new ConnectionWhy(deps, sourceNoteId ?? '');
  }, [sourceNoteId]);

  const map = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  return {
    whyState: (relatedNoteId) => map[relatedNoteId] ?? COLLAPSED,
    expand: controller.expand,
    retry: controller.retry,
  };
}
