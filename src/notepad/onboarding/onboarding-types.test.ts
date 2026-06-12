// src/notepad/onboarding/onboarding-types.test.ts
import { describe, it, expect } from 'vitest';
import {
  ANON_EVENT_TO_ITEM,
  JOURNEY_EVENT_TO_ITEM,
  defaultAccountProgress,
  defaultAnonProgress,
} from './onboarding-types';

describe('onboarding event maps', () => {
  it('maps anon completion events to anon item ids', () => {
    expect(ANON_EVENT_TO_ITEM['note-created']).toBe('write-first-note');
    expect(ANON_EVENT_TO_ITEM['verse-linked']).toBe('link-verse');
    expect(ANON_EVENT_TO_ITEM['highlight-created']).toBe('highlight');
  });

  it('does not map account-only events into the anon set', () => {
    expect(ANON_EVENT_TO_ITEM['folder-created']).toBeUndefined();
    expect(ANON_EVENT_TO_ITEM['scan-completed']).toBeUndefined();
  });

  it('maps journey events to journey item ids', () => {
    expect(JOURNEY_EVENT_TO_ITEM['note-created']).toBe('first-study-note');
    expect(JOURNEY_EVENT_TO_ITEM['folder-created']).toBe('create-folder');
    expect(JOURNEY_EVENT_TO_ITEM['scan-completed']).toBe('scan-note');
    expect(JOURNEY_EVENT_TO_ITEM['lamplight-connection']).toBe('lamplight-connections');
    expect(JOURNEY_EVENT_TO_ITEM['graph-visited']).toBe('visit-graph');
    expect(JOURNEY_EVENT_TO_ITEM['search-used']).toBe('search-notes');
  });

  it('streak-3 is not directly event-mapped (computed from studyDates)', () => {
    expect(Object.values(JOURNEY_EVENT_TO_ITEM)).not.toContain('streak-3');
  });

  it('default progress shapes are empty and unmerged', () => {
    expect(defaultAnonProgress()).toEqual({ items: {}, dismissed: false });
    expect(defaultAccountProgress()).toEqual({
      guidedNote: 'pending', items: {}, dismissed: false, studyDates: [], merged: false,
    });
  });
});
