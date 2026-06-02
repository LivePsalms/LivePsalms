import { describe, it, expect } from 'vitest';
import { emptyStateMessage } from './empty-state-message';

describe('emptyStateMessage', () => {
  it('personalizes with the first name', () => {
    expect(emptyStateMessage('Natalie Magee')).toBe('The page is yours, Natalie.');
  });

  it('uses a single-word name', () => {
    expect(emptyStateMessage('Plato')).toBe('The page is yours, Plato.');
  });

  it('falls back to the name-less line for null', () => {
    expect(emptyStateMessage(null)).toBe('The page is yours.');
  });

  it('falls back to the name-less line for undefined', () => {
    expect(emptyStateMessage(undefined)).toBe('The page is yours.');
  });

  it('falls back for whitespace-only names', () => {
    expect(emptyStateMessage('   ')).toBe('The page is yours.');
  });

  it('falls back when the name fails sanitization', () => {
    expect(emptyStateMessage('<script>')).toBe('The page is yours.');
  });
});
