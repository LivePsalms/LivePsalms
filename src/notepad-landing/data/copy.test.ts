import { describe, it, expect } from 'vitest';
import { copy } from './copy';

describe('notepad landing copy (locked)', () => {
  it('hero H1 is the locked line', () => {
    expect(copy.section01.h1).toBe('Everything God’s said to you. In one place that remembers.');
  });

  it('hero subtitle matches the locked copy', () => {
    expect(copy.section01.sub).toBe(
      'Your devotions, your sermon notes, the verses you keep coming back to — written down, connected, and quietly read back to you when you need it.',
    );
  });

  it('hero CTA note reassures no-account / offline', () => {
    expect(copy.section01.ctaNote).toBe('No account needed to start. Works offline.');
  });

  it('primary CTA reads "Open your notepad →"', () => {
    expect(copy.section01.ctaPrimary).toBe('Open your notepad →');
  });

  it('closing CTA repeats the primary', () => {
    expect(copy.section09.ctaPrimary).toBe('Open your notepad →');
  });

  it('Lamplight section leads with the "already knows" framing', () => {
    expect(copy.section04.h2).toBe('Most apps wait for you to type. This one already knows.');
  });

  it('Lamplight shows its work (cites the source note and verse)', () => {
    expect(copy.section04.detail).toMatch(/names the note and the verse/);
  });

  it('seven papers includes all seven paper names', () => {
    const names = copy.section06.papers.map((p) => p.name);
    expect(names).toEqual(['Linen', 'Vellum', 'Margin', 'Dotted Crème', 'Ruled Walnut', 'Communion', 'Folio']);
  });
});
