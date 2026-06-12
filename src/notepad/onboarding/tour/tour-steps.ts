export interface TourStep {
  id: string;
  anchor: string;          // CSS selector, e.g. '[data-tour="new-note-sidebar-button"]'
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export const TOUR_STEPS: TourStep[] = [
  { id: 'create-note', anchor: '[data-tour="new-note-sidebar-button"]', title: 'Create a note', body: 'Start every study here. Tap to make your first note.', placement: 'right' },
  { id: 'verse-linking', anchor: '[data-tour="editor-bible-panel"]', title: 'Link verses', body: 'Type a reference and it becomes a living link to Scripture.', placement: 'left' },
  { id: 'highlights', anchor: '[data-tour="highlight-toolbar"]', title: 'Highlight & decorate', body: 'Select text to highlight the lines that matter.', placement: 'bottom' },
  { id: 'graph', anchor: '[data-tour="graph-toggle-button"]', title: 'See connections', body: 'Your notes and verses form a graph of backlinks.', placement: 'bottom' },
  { id: 'lamplight', anchor: '[data-tour="lamplight-panel-entry"]', title: 'Ask Lamplight', body: 'Discover connections between what you are studying and your notes.', placement: 'left' },
];

/** The final sign-up nudge card has no anchor — rendered centered. */
export const TOUR_SIGNUP_CARD = {
  title: 'Make it yours',
  body: 'Create a free account to save your notes across devices.',
  cta: 'Create account',
};
