import { describe, it, expect } from 'vitest';
import { TOUR_STEPS, TOUR_SIGNUP_CARD } from './tour-steps';

describe('tour-steps', () => {
  it('defines the five spotlight stops with anchors and copy', () => {
    expect(TOUR_STEPS).toHaveLength(5);
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(['create-note', 'verse-linking', 'highlights', 'graph', 'lamplight']);
    expect(TOUR_STEPS.every((s) => s.anchor.startsWith('[data-tour='))).toBe(true);
    expect(TOUR_STEPS.every((s) => s.title && s.body)).toBe(true);
  });
  it('final sign-up card has a CTA', () => {
    expect(TOUR_SIGNUP_CARD.cta.length).toBeGreaterThan(0);
  });
});
