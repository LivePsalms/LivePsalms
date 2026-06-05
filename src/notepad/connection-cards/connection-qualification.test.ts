import { describe, it, expect } from 'vitest';
import { decideConnectionQualification } from './connection-qualification';

const base = { hasActiveNote: true, wordCount: 150, totalNoteCount: 50, minWords: 10, minVaultSize: 2 };

describe('decideConnectionQualification', () => {
  it('no_active_note when there is no active note (still reports meetsVault)', () => {
    expect(decideConnectionQualification({ ...base, hasActiveNote: false }))
      .toEqual({ qualified: false, reason: 'no_active_note', meetsDepth: false, meetsVault: true });
  });

  it('note_too_short when word count is below minWords', () => {
    expect(decideConnectionQualification({ ...base, wordCount: 5 }))
      .toEqual({ qualified: false, reason: 'note_too_short', meetsDepth: false, meetsVault: true });
  });

  it('vault_too_small when depth passes but the vault is too small', () => {
    expect(decideConnectionQualification({ ...base, totalNoteCount: 1 }))
      .toEqual({ qualified: false, reason: 'vault_too_small', meetsDepth: true, meetsVault: false });
  });

  it('short note reports meetsVault=false when the vault is also too small', () => {
    expect(decideConnectionQualification({ ...base, wordCount: 5, totalNoteCount: 1 }))
      .toEqual({ qualified: false, reason: 'note_too_short', meetsDepth: false, meetsVault: false });
  });

  it('qualified when active, deep enough, and vault large enough', () => {
    expect(decideConnectionQualification(base))
      .toEqual({ qualified: true, meetsDepth: true, meetsVault: true });
  });
});
