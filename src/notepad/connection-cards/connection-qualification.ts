export type QualificationReason = 'no_active_note' | 'note_too_short' | 'vault_too_small';

export interface QualificationInput {
  hasActiveNote: boolean;
  wordCount: number;
  totalNoteCount: number;
  minWords: number;
  minVaultSize: number;
}

export type QualificationResult =
  | { qualified: false; reason: QualificationReason; meetsDepth: boolean; meetsVault: boolean }
  | { qualified: true; meetsDepth: true; meetsVault: true };

export function decideConnectionQualification(input: QualificationInput): QualificationResult {
  const meetsVault = input.totalNoteCount >= input.minVaultSize;
  if (!input.hasActiveNote) {
    return { qualified: false, reason: 'no_active_note', meetsDepth: false, meetsVault };
  }
  const meetsDepth = input.wordCount >= input.minWords;
  if (!meetsDepth) {
    return { qualified: false, reason: 'note_too_short', meetsDepth: false, meetsVault };
  }
  if (!meetsVault) {
    return { qualified: false, reason: 'vault_too_small', meetsDepth: true, meetsVault: false };
  }
  return { qualified: true, meetsDepth: true, meetsVault: true };
}
