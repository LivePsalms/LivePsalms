import { Observable } from '../collection/observable';
import type { ConnectionWhyResult } from '../storage/lamplight-adapter';

export interface ConnectionCardWhyState {
  phase: 'collapsed' | 'loading' | 'shown' | 'error';
  text?: string;
  cached?: boolean;
  reason?: 'validators_failed' | 'network';
}

export interface ConnectionWhyDeps {
  generateConnectionWhy: (sourceNoteId: string, relatedNoteId: string) => Promise<ConnectionWhyResult>;
}

type WhyMap = Record<string, ConnectionCardWhyState>;

const COLLAPSED: ConnectionCardWhyState = { phase: 'collapsed' };

export class ConnectionWhy extends Observable<WhyMap> {
  private readonly deps: ConnectionWhyDeps;
  private readonly sourceNoteId: string;

  constructor(deps: ConnectionWhyDeps, sourceNoteId: string) {
    super({});
    this.deps = deps;
    this.sourceNoteId = sourceNoteId;
  }

  whyState(relatedNoteId: string): ConnectionCardWhyState {
    return this.getSnapshot()[relatedNoteId] ?? COLLAPSED;
  }

  private set(relatedNoteId: string, next: ConnectionCardWhyState): void {
    this.setState((prev) => ({ ...prev, [relatedNoteId]: next }));
  }

  expand = async (relatedNoteId: string): Promise<void> => {
    this.set(relatedNoteId, { phase: 'loading' });
    let result: ConnectionWhyResult;
    try {
      result = await this.deps.generateConnectionWhy(this.sourceNoteId, relatedNoteId);
    } catch {
      this.set(relatedNoteId, { phase: 'error', reason: 'network' });
      return;
    }
    if (result.ok) {
      this.set(relatedNoteId, { phase: 'shown', text: result.why, cached: result.cached });
    } else {
      const reason = result.reason === 'validators_failed' ? 'validators_failed' : 'network';
      this.set(relatedNoteId, { phase: 'error', reason });
    }
  };

  retry = (relatedNoteId: string): Promise<void> => this.expand(relatedNoteId);
}
