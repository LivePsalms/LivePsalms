import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ConnectionDiscovery,
  type ConnectionDiscoveryDeps,
  type ConnectionDiscoveryState,
  type DiscoveryMode,
} from '../connection-cards/connection-discovery';
import type { LamplightAdapter } from '../storage/lamplight-adapter';
import type { Note } from '../types';

const NEIGHBOR_K = 5;

export interface UseConnectionDiscoveryArgs {
  adapter: LamplightAdapter | null;
  activeNote: Note | null;
  totalNoteCount: number;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
  mode: DiscoveryMode;
  qualifyingMinWords?: number;
  qualifyingMinVaultSize?: number;
  qualifyingMinSimilarity?: number;
  maxRenderedCards?: number;
}

export interface UseConnectionDiscoveryResult {
  state: ConnectionDiscoveryState;
  retry: () => void;
}

export function useConnectionDiscovery({
  adapter,
  activeNote,
  totalNoteCount,
  loadNeighborNotes,
  mode,
  qualifyingMinWords = 10,
  qualifyingMinVaultSize = 2,
  qualifyingMinSimilarity = 0.78,
  maxRenderedCards = 3,
}: UseConnectionDiscoveryArgs): UseConnectionDiscoveryResult {
  // Captured via ref so an unstable inline loadNeighborNotes doesn't recreate the controller.
  const loadRef = useRef(loadNeighborNotes);
  loadRef.current = loadNeighborNotes;

  const controller = useMemo(() => {
    // When the adapter is absent the gate short-circuits before these are
    // called, but we null-guard here defensively so no non-null assertion
    // can throw if a future caller reaches these paths unexpectedly.
    const deps: ConnectionDiscoveryDeps = {
      hasNoteEmbedding: (id) => (adapter ? adapter.hasNoteEmbedding(id) : Promise.resolve(false)),
      getConnectionNeighbors: (id, k, sim) =>
        adapter ? adapter.getConnectionNeighbors(id, k, sim) : Promise.resolve([]),
      loadNeighborNotes: (ids) => loadRef.current(ids),
    };
    return new ConnectionDiscovery(deps, mode);
  }, [adapter, mode]);

  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    controller.setInputs({
      // When the adapter is absent, park inactive by passing a null active note;
      // the gate short-circuits before any adapter call.
      activeNote: adapter ? activeNote : null,
      totalNoteCount,
      minWords: qualifyingMinWords,
      minVaultSize: qualifyingMinVaultSize,
      minSimilarity: qualifyingMinSimilarity,
      maxRenderedCards,
      neighborK: NEIGHBOR_K,
    });
  }, [
    controller,
    adapter,
    activeNote,
    totalNoteCount,
    qualifyingMinWords,
    qualifyingMinVaultSize,
    qualifyingMinSimilarity,
    maxRenderedCards,
    retryNonce,
  ]);

  useEffect(() => () => controller.dispose(), [controller]);

  const retry = useCallback(() => setRetryNonce((n) => n + 1), []);

  return { state, retry };
}
