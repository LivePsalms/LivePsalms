import { describe, it, expect } from 'vitest';
import { validatePrettify, DENSITY_BUDGETS } from './prettify-validators';

const CONTENT =
  'Grace is sufficient for me. The thorn remains. Grace is sufficient for me again.';

describe('validatePrettify', () => {
  it('keeps verbatim quotes and drops paraphrases', () => {
    const { plan, survived } = validatePrettify(
      {
        summary: 's',
        highlights: [
          { quote: 'Grace is sufficient for me', role: 'key-point' },
          { quote: 'grace abounds everywhere', role: 'topic' },
        ],
        decorations: [],
        connections: [],
      },
      CONTENT,
      'balanced',
    );
    expect(survived).toBe(true);
    expect(plan.highlights).toHaveLength(1);
    expect(plan.highlights[0].quote).toBe('Grace is sufficient for me');
  });

  it('matches whitespace-tolerant and case-insensitive', () => {
    const { plan } = validatePrettify(
      {
        summary: '',
        highlights: [{ quote: 'GRACE   is\nsufficient', role: 'theme' }],
        decorations: [],
        connections: [],
      },
      CONTENT,
      'balanced',
    );
    expect(plan.highlights).toHaveLength(1);
  });

  it('clamps out-of-range occurrence to 1', () => {
    const { plan } = validatePrettify(
      {
        summary: '',
        highlights: [{ quote: 'Grace is sufficient for me', occurrence: 9, role: 'key-point' }],
        decorations: [],
        connections: [],
      },
      CONTENT,
      'balanced',
    );
    expect(plan.highlights[0].occurrence).toBe(1);
  });

  it('drops unknown roles and kinds', () => {
    const { plan } = validatePrettify(
      {
        summary: '',
        highlights: [{ quote: 'The thorn remains', role: 'bogus' }],
        decorations: [{ quote: 'The thorn remains', kind: 'sparkle' }],
        connections: [],
      },
      CONTENT,
      'balanced',
    );
    expect(plan.highlights).toHaveLength(0);
    expect(plan.decorations).toHaveLength(0);
  });

  it('truncates each list to the density budget', () => {
    const many = Array.from({ length: 10 }, () => ({
      quote: 'Grace is sufficient for me',
      role: 'key-point' as const,
    }));
    const { plan } = validatePrettify(
      { summary: '', highlights: many, decorations: [], connections: [] },
      CONTENT,
      'light',
    );
    // Light key-point budget is 3.
    expect(plan.highlights.length).toBe(DENSITY_BUDGETS.light.keyPoint);
  });

  it('caps topic+theme highlights as a combined budget', () => {
    const { plan } = validatePrettify(
      {
        summary: '',
        highlights: [
          { quote: 'The thorn remains', role: 'topic' },
          { quote: 'Grace is sufficient for me', role: 'theme' },
        ],
        decorations: [],
        connections: [],
      },
      CONTENT,
      'light',
    );
    // Light topic/theme combined budget is 1.
    const nonKey = plan.highlights.filter((h) => h.role !== 'key-point');
    expect(nonKey.length).toBe(1);
  });

  it('drops connections with an unresolved endpoint', () => {
    const { plan } = validatePrettify(
      {
        summary: '',
        highlights: [],
        decorations: [],
        connections: [
          { from_quote: 'Grace is sufficient for me', to_quote: 'The thorn remains' },
          { from_quote: 'Grace is sufficient for me', to_quote: 'not in the note' },
        ],
      },
      CONTENT,
      'balanced',
    );
    expect(plan.connections).toHaveLength(1);
  });

  it('reports survived=false when nothing semantic remains', () => {
    const { survived, plan } = validatePrettify(
      {
        summary: 'just a summary',
        highlights: [{ quote: 'nowhere text', role: 'key-point' }],
        decorations: [],
        connections: [],
      },
      CONTENT,
      'balanced',
    );
    expect(survived).toBe(false);
    expect(plan.highlights).toHaveLength(0);
  });
});
