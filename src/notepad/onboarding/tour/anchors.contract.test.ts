import { describe, it, expect } from 'vitest';
import { TOUR_STEPS } from './tour-steps';

/** Guards against drift between TOUR_STEPS selectors and the data-tour values
 *  added to the workspace. Update both together. */
describe('tour anchor contract', () => {
  it('every step targets a known data-tour token', () => {
    const tokens = TOUR_STEPS.map((s) => s.anchor.replace('[data-tour="', '').replace('"]', ''));
    expect(tokens).toEqual([
      'new-note-sidebar-button', 'editor-bible-panel', 'highlight-toolbar',
      'graph-toggle-button', 'lamplight-panel-entry',
    ]);
  });
});
