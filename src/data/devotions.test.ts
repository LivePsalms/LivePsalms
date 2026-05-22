import { describe, it, expect } from 'vitest';
import { devotions, type Devotion } from './devotions';

const REQUIRED_IDS = [
  'peace',
  'hope',
  'strength',
  'wholeness',
  'purpose',
  'connection',
  'identity',
  'joy',
  'forgiveness',
  'surrender',
  'trust',
];

describe('devotions data', () => {
  it('has an entry for each of the 11 devotion project ids', () => {
    for (const id of REQUIRED_IDS) {
      expect(devotions[id], `missing devotion for ${id}`).toBeDefined();
    }
  });

  it('every devotion has non-empty title, label, scriptureRef, monogram, firstMoodboardImage', () => {
    for (const id of REQUIRED_IDS) {
      const d: Devotion = devotions[id];
      expect(d.title.length, `${id}.title`).toBeGreaterThan(0);
      expect(d.label.length, `${id}.label`).toBeGreaterThan(0);
      expect(d.scriptureRef.length, `${id}.scriptureRef`).toBeGreaterThan(0);
      expect(d.monogram.length, `${id}.monogram`).toBe(2);
      expect(d.firstMoodboardImage.startsWith('/'), `${id}.firstMoodboardImage`).toBe(true);
    }
  });

  it('monograms are uppercase ASCII letters', () => {
    for (const id of REQUIRED_IDS) {
      expect(devotions[id].monogram, `${id}.monogram`).toMatch(/^[A-Z]{2}$/);
    }
  });
});
