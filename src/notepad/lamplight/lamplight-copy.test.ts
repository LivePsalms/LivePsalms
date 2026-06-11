import { describe, it, expect } from 'vitest';
import {
  loadingState,
  emptyStateInsufficientNotes,
  generationFailedToast,
  todaysLampIntro,
} from './lamplight-copy';

describe('loadingState', () => {
  it('returns personalized form when firstName is present', () => {
    expect(loadingState('Sarah')).toBe("Sarah, Today's Lamp is on its way…");
  });

  it('returns unpersonalized form when firstName is null', () => {
    expect(loadingState(null)).toBe("Today's Lamp is on its way…");
  });
});

describe('emptyStateInsufficientNotes', () => {
  it('returns personalized form when firstName is present', () => {
    expect(emptyStateInsufficientNotes('Sarah'))
      .toBe("Sarah, write a few more notes this week and Today's Lamp will appear here.");
  });

  it('returns unpersonalized form when firstName is null', () => {
    expect(emptyStateInsufficientNotes(null))
      .toBe("Write a few more notes this week and Today's Lamp will appear here.");
  });
});

describe('generationFailedToast', () => {
  it('returns personalized form when firstName is present', () => {
    expect(generationFailedToast('Sarah'))
      .toBe("Sarah, we couldn't generate Today's Lamp — try again?");
  });

  it('returns unpersonalized form when firstName is null', () => {
    expect(generationFailedToast(null))
      .toBe("We couldn't generate Today's Lamp — try again?");
  });
});

describe('todaysLampIntro', () => {
  it('returns personalized form when firstName is present', () => {
    expect(todaysLampIntro('Sarah')).toBe(
      "Sarah, Today's Lamp draws from your recent notes — a piece of Scripture and a short reflection for where you are right now.",
    );
  });

  it('returns unpersonalized form when firstName is null', () => {
    expect(todaysLampIntro(null)).toBe(
      "Today's Lamp draws from your recent notes — a piece of Scripture and a short reflection for where you are right now.",
    );
  });
});
