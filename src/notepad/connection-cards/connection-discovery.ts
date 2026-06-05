import { Observable } from '../collection/observable';
import { extractTextFromNote } from '../utils/tiptap-text';
import {
  computeSharedSignals as defaultComputeSharedSignals,
  type SharedSignals,
} from '../utils/connection-signals';
import { decideConnectionQualification, type QualificationReason } from './connection-qualification';
import type { ConnectionNeighbor } from '../storage/lamplight-adapter';
import type { Note } from '../types';

export interface ConnectionCard {
  relatedNoteId: string;
  relatedNoteTitle: string;
  similarity: number;
  sharedTags: string[];
  sharedVerseRefs: string[];
}

export type ConnectionDiscoveryState =
  | { phase: 'inactive'; reason: QualificationReason; meetsDepth: boolean; meetsVault: boolean }
  | { phase: 'waiting_for_embedding' }
  | { phase: 'no_connections' }
  | { phase: 'present'; count: number }
  | { phase: 'ready'; cards: ConnectionCard[] }
  | { phase: 'error'; reason: 'network' };

export type DiscoveryMode = 'presence' | 'full';

export interface ConnectionDiscoveryDeps {
  hasNoteEmbedding: (noteId: string) => Promise<boolean>;
  getConnectionNeighbors: (
    sourceNoteId: string,
    k: number,
    minSimilarity: number,
  ) => Promise<ConnectionNeighbor[]>;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
  /** Test seam; production code uses the default. */
  computeSharedSignals?: (active: Note, related: Note) => SharedSignals;
}

export interface ConnectionDiscoveryInputs {
  activeNote: Note | null;
  totalNoteCount: number;
  minWords: number;
  minVaultSize: number;
  minSimilarity: number;
  maxRenderedCards: number;
  neighborK: number;
}

const INACTIVE_INITIAL: ConnectionDiscoveryState = {
  phase: 'inactive',
  reason: 'no_active_note',
  meetsDepth: false,
  meetsVault: false,
};

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export class ConnectionDiscovery extends Observable<ConnectionDiscoveryState> {
  private readonly deps: ConnectionDiscoveryDeps;
  private readonly mode: DiscoveryMode;
  private readonly computeSignals: (active: Note, related: Note) => SharedSignals;
  private generation = 0;

  constructor(deps: ConnectionDiscoveryDeps, mode: DiscoveryMode) {
    super(INACTIVE_INITIAL);
    this.deps = deps;
    this.mode = mode;
    this.computeSignals = deps.computeSharedSignals ?? defaultComputeSharedSignals;
  }

  setInputs(inputs: ConnectionDiscoveryInputs): void {
    const gen = ++this.generation;
    void this.run(gen, inputs);
  }

  /** Bumps the generation so any in-flight run's late resolves are dropped. */
  dispose(): void {
    this.generation++;
  }

  private isStale(gen: number): boolean {
    return gen !== this.generation;
  }

  private emit(gen: number, next: ConnectionDiscoveryState): void {
    if (this.isStale(gen)) return;
    this.setState(() => next);
  }

  private async run(gen: number, inputs: ConnectionDiscoveryInputs): Promise<void> {
    const { activeNote, totalNoteCount, minWords, minVaultSize, minSimilarity, maxRenderedCards, neighborK } = inputs;

    const wordCount = activeNote ? countWords(extractTextFromNote(activeNote)) : 0;
    const gate = decideConnectionQualification({
      hasActiveNote: activeNote !== null,
      wordCount,
      totalNoteCount,
      minWords,
      minVaultSize,
    });
    if (!gate.qualified) {
      this.emit(gen, {
        phase: 'inactive',
        reason: gate.reason,
        meetsDepth: gate.meetsDepth,
        meetsVault: gate.meetsVault,
      });
      return;
    }
    const note = activeNote as Note; // qualified ⇒ non-null

    const hasEmbedding = await this.deps.hasNoteEmbedding(note.id);
    if (this.isStale(gen)) return;
    if (!hasEmbedding) {
      this.emit(gen, { phase: 'waiting_for_embedding' });
      return;
    }

    let neighbors: ConnectionNeighbor[];
    try {
      neighbors = await this.deps.getConnectionNeighbors(note.id, neighborK, minSimilarity);
    } catch {
      this.emit(gen, { phase: 'error', reason: 'network' });
      return;
    }
    if (this.isStale(gen)) return;
    if (neighbors.length === 0) {
      this.emit(gen, { phase: 'no_connections' });
      return;
    }

    if (this.mode === 'presence') {
      this.emit(gen, { phase: 'present', count: neighbors.length });
      return;
    }

    let neighborNotes: Note[];
    try {
      neighborNotes = await this.deps.loadNeighborNotes(neighbors.map((n) => n.relatedNoteId));
    } catch {
      this.emit(gen, { phase: 'error', reason: 'network' });
      return;
    }
    if (this.isStale(gen)) return;
    const byId = new Map(neighborNotes.map((n) => [n.id, n]));

    const cards: ConnectionCard[] = neighbors.slice(0, maxRenderedCards).map((n) => {
      const neighborNote = byId.get(n.relatedNoteId);
      const signals = neighborNote
        ? this.computeSignals(note, neighborNote)
        : { sharedTags: [], sharedVerseRefs: [] };
      return {
        relatedNoteId: n.relatedNoteId,
        relatedNoteTitle: neighborNote?.title?.trim() || '(untitled)',
        similarity: n.similarity,
        sharedTags: signals.sharedTags.slice(0, 3),
        sharedVerseRefs: signals.sharedVerseRefs.slice(0, 3),
      };
    });
    this.emit(gen, { phase: 'ready', cards });
  }
}
