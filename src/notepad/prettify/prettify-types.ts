export type PrettifyDensity = 'light' | 'balanced' | 'rich';
export type HighlightRole = 'key-point' | 'topic' | 'theme';
export type DecorationKind = 'underline' | 'bracket' | 'margin-arrow';

export const DENSITIES: readonly PrettifyDensity[] = ['light', 'balanced', 'rich'];

export function isPrettifyDensity(v: unknown): v is PrettifyDensity {
  return v === 'light' || v === 'balanced' || v === 'rich';
}

export interface PrettifyHighlight {
  quote: string;
  occurrence?: number;
  role: HighlightRole;
}

export interface PrettifyDecoration {
  quote: string;
  occurrence?: number;
  kind: DecorationKind;
}

export interface PrettifyConnection {
  from_quote: string;
  from_occurrence?: number;
  to_quote: string;
  to_occurrence?: number;
}

export interface PrettifyPlan {
  summary: string;
  highlights: PrettifyHighlight[];
  decorations: PrettifyDecoration[];
  connections: PrettifyConnection[];
}

export type PrettifyReason =
  | 'no_content'
  | 'disabled'
  | 'quota'
  | 'validators_failed'
  | 'network';

export type PrettifyResult =
  | { ok: true; plan: PrettifyPlan }
  | { ok: false; reason: PrettifyReason };
