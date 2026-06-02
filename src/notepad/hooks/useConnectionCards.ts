import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ConnectionNeighbor,
  ConnectionWhyResult,
  LamplightAdapter,
} from '../storage/lamplight-adapter';
import type { Note } from '../types';
import { extractTextFromNote } from '../utils/tiptap-text';
import { computeSharedSignals } from '../utils/connection-signals';

export interface ConnectionCardWhyState {
  phase: 'collapsed' | 'loading' | 'shown' | 'error';
  text?: string;
  cached?: boolean;
  reason?: 'validators_failed' | 'network';
}

export interface ConnectionCard {
  relatedNoteId: string;
  relatedNoteTitle: string;
  similarity: number;
  sharedTags: string[];
  sharedVerseRefs: string[];
  why: ConnectionCardWhyState;
}

export type ConnectionCardsState =
  | {
      phase: 'inactive';
      reason: 'no_active_note' | 'note_too_short' | 'vault_too_small';
      meetsDepth: boolean;
      meetsVault: boolean;
    }
  | { phase: 'waiting_for_embedding' }
  | { phase: 'no_connections' }
  | { phase: 'ready'; cards: ConnectionCard[] }
  | { phase: 'error'; reason: 'network' };

export interface UseConnectionCardsArgs {
  adapter: LamplightAdapter;
  userId: string;
  activeNote: Note | null;
  totalNoteCount: number;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
  qualifyingMinWords?: number;
  qualifyingMinVaultSize?: number;
  qualifyingMinSimilarity?: number;
  maxRenderedCards?: number;
}

export interface UseConnectionCardsResult {
  state: ConnectionCardsState;
  expandCard: (relatedNoteId: string) => Promise<void>;
  retryWhy: (relatedNoteId: string) => Promise<void>;
  retry: () => void;
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function useConnectionCards(
  args: UseConnectionCardsArgs,
): UseConnectionCardsResult {
  const {
    adapter,
    activeNote,
    totalNoteCount,
    loadNeighborNotes,
    // qualifyingMinSimilarity defaults to the spec value (0.78) so that, in
    // production, a missing or in-flight server config never causes the strip
    // to request neighbors the edge function would later refuse to explain.
    // The Connection Cards strip overrides this with the value sourced from
    // `app_config.lamplight_min_similarity` (see ConnectionCardsStrip.tsx).
    //
    // minWords / minVaultSize remain at dev-loosened values for now (spec is
    // 100 / 10); they are client-only gates and do not affect the server
    // contract, so they don't need server sourcing.
    qualifyingMinWords = 10,
    qualifyingMinVaultSize = 2,
    qualifyingMinSimilarity = 0.78,
    maxRenderedCards = 3,
  } = args;

  const [state, setState] = useState<ConnectionCardsState>({
    phase: 'inactive',
    reason: 'no_active_note',
    meetsDepth: false,
    meetsVault: false,
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const cancelledRef = useRef(false);
  const generationRef = useRef(0);
  // Retained neighbor list (up to k=5) for potential future "see more" UX.
  const retainedNeighborsRef = useRef<ConnectionNeighbor[]>([]);
  // Latest loadNeighborNotes reference — captured via ref so an unstable
  // inline-arrow-fn from a parent doesn't retrigger the run() loop forever.
  const loadNeighborNotesRef = useRef(loadNeighborNotes);
  useEffect(() => {
    loadNeighborNotesRef.current = loadNeighborNotes;
  }, [loadNeighborNotes]);

  useEffect(() => {
    cancelledRef.current = false;
    const gen = ++generationRef.current;

    async function run() {
      const meetsVault = totalNoteCount >= qualifyingMinVaultSize;

      if (!activeNote) {
        setState({ phase: 'inactive', reason: 'no_active_note', meetsDepth: false, meetsVault });
        return;
      }
      const plaintext = extractTextFromNote(activeNote);
      const meetsDepth = countWords(plaintext) >= qualifyingMinWords;
      if (!meetsDepth) {
        setState({ phase: 'inactive', reason: 'note_too_short', meetsDepth: false, meetsVault });
        return;
      }
      if (!meetsVault) {
        setState({ phase: 'inactive', reason: 'vault_too_small', meetsDepth: true, meetsVault: false });
        return;
      }

      const hasEmbedding = await adapter.hasNoteEmbedding(activeNote.id);
      if (cancelledRef.current || gen !== generationRef.current) return;
      if (!hasEmbedding) {
        setState({ phase: 'waiting_for_embedding' });
        return;
      }

      let neighbors: ConnectionNeighbor[];
      try {
        neighbors = await adapter.getConnectionNeighbors(
          activeNote.id,
          5,
          qualifyingMinSimilarity,
        );
      } catch {
        if (cancelledRef.current || gen !== generationRef.current) return;
        setState({ phase: 'error', reason: 'network' });
        return;
      }
      if (cancelledRef.current || gen !== generationRef.current) return;
      if (neighbors.length === 0) {
        setState({ phase: 'no_connections' });
        return;
      }
      retainedNeighborsRef.current = neighbors;

      let neighborNotes: Note[];
      try {
        neighborNotes = await loadNeighborNotesRef.current(neighbors.map((n) => n.relatedNoteId));
      } catch {
        if (cancelledRef.current || gen !== generationRef.current) return;
        setState({ phase: 'error', reason: 'network' });
        return;
      }
      if (cancelledRef.current || gen !== generationRef.current) return;
      const neighborNotesById = new Map(neighborNotes.map((n) => [n.id, n]));

      const cards: ConnectionCard[] = neighbors
        .slice(0, maxRenderedCards)
        .map((n) => {
          const neighborNote = neighborNotesById.get(n.relatedNoteId);
          const signals = neighborNote
            ? computeSharedSignals(activeNote, neighborNote)
            : { sharedTags: [], sharedVerseRefs: [] };
          return {
            relatedNoteId: n.relatedNoteId,
            relatedNoteTitle: neighborNote?.title?.trim() || '(untitled)',
            similarity: n.similarity,
            sharedTags: signals.sharedTags.slice(0, 3),
            sharedVerseRefs: signals.sharedVerseRefs.slice(0, 3),
            why: { phase: 'collapsed' },
          };
        });

      setState({ phase: 'ready', cards });
    }

    run();
    return () => {
      cancelledRef.current = true;
    };
  }, [
    adapter,
    activeNote,
    totalNoteCount,
    qualifyingMinWords,
    qualifyingMinVaultSize,
    qualifyingMinSimilarity,
    maxRenderedCards,
    retryNonce,
  ]);

  const updateCardWhy = useCallback(
    (relatedNoteId: string, next: ConnectionCardWhyState) => {
      setState((prev) => {
        if (prev.phase !== 'ready') return prev;
        return {
          phase: 'ready',
          cards: prev.cards.map((c) =>
            c.relatedNoteId === relatedNoteId ? { ...c, why: next } : c,
          ),
        };
      });
    },
    [],
  );

  const expandCard = useCallback(
    async (relatedNoteId: string) => {
      if (!activeNote) return;
      updateCardWhy(relatedNoteId, { phase: 'loading' });
      let result: ConnectionWhyResult;
      try {
        result = await adapter.generateConnectionWhy(activeNote.id, relatedNoteId);
      } catch {
        updateCardWhy(relatedNoteId, { phase: 'error', reason: 'network' });
        return;
      }
      if (result.ok) {
        updateCardWhy(relatedNoteId, {
          phase: 'shown',
          text: result.why,
          cached: result.cached,
        });
      } else {
        const reason =
          result.reason === 'validators_failed' ? 'validators_failed' : 'network';
        updateCardWhy(relatedNoteId, { phase: 'error', reason });
      }
    },
    [activeNote, adapter, updateCardWhy],
  );

  const retryWhy = useCallback(
    (relatedNoteId: string) => expandCard(relatedNoteId),
    [expandCard],
  );

  const retry = useCallback(() => {
    setRetryNonce((n) => n + 1);
  }, []);

  return { state, expandCard, retryWhy, retry };
}
