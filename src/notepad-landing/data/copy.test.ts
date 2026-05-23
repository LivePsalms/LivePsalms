import { describe, it, expect } from 'vitest';
import { copy } from './copy';

describe('notepad landing copy (locked)', () => {
  it('hero H1 is the locked Alt 2 line', () => {
    expect(copy.section01.h1).toBe('For what you cannot afford to forget.');
  });

  it('hero subtitle matches the locked copy', () => {
    expect(copy.section01.sub).toBe(
      'The notepad that remembers what God has been saying — across your devotions, your sermons, the threads you’ve been walking with for months.',
    );
  });

  it('primary CTA reads "Open your notepad →"', () => {
    expect(copy.section01.ctaPrimary).toBe('Open your notepad →');
  });

  it('closing CTA repeats the primary', () => {
    expect(copy.section09.ctaPrimary).toBe('Open your notepad →');
  });

  it('Lamplight section refuses chatbot framing', () => {
    expect(copy.section04.body).toMatch(/Lamplight is not a chatbot/);
  });

  it('seven papers includes all seven paper names', () => {
    const names = copy.section06.papers.map((p) => p.name);
    expect(names).toEqual(['Linen', 'Vellum', 'Margin', 'Dotted Crème', 'Ruled Walnut', 'Communion', 'Folio']);
  });
});
