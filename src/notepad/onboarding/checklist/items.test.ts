// src/notepad/onboarding/checklist/items.test.ts
import { describe, it, expect } from 'vitest';
import { GET_STARTED_ITEMS } from './get-started-items';
import { JOURNEY_ITEMS } from './journey-items';
import { ALL_ANON_ITEM_IDS, ALL_JOURNEY_ITEM_IDS } from '../onboarding-types';

describe('checklist item definitions', () => {
  it('get-started has exactly the 4 anon items with labels, in order', () => {
    expect(GET_STARTED_ITEMS.map((i) => i.id)).toEqual([
      'write-first-note', 'link-verse', 'highlight', 'create-account',
    ]);
    expect(GET_STARTED_ITEMS.every((i) => i.label.length > 0)).toBe(true);
    expect(new Set(GET_STARTED_ITEMS.map((i) => i.id))).toEqual(new Set(ALL_ANON_ITEM_IDS));
  });

  it('journey has exactly the 7 items with labels, in order', () => {
    expect(JOURNEY_ITEMS.map((i) => i.id)).toEqual([
      'first-study-note', 'create-folder', 'scan-note',
      'lamplight-connections', 'visit-graph', 'streak-3', 'search-notes',
    ]);
    expect(JOURNEY_ITEMS.every((i) => i.label.length > 0)).toBe(true);
    expect(new Set(JOURNEY_ITEMS.map((i) => i.id))).toEqual(new Set(ALL_JOURNEY_ITEM_IDS));
  });
});
