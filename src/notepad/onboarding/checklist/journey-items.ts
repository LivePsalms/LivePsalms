// src/notepad/onboarding/checklist/journey-items.ts
import type { JourneyItemId } from '../onboarding-types';
import type { ChecklistItemDef } from './get-started-items';

export const JOURNEY_ITEMS: ChecklistItemDef<JourneyItemId>[] = [
  { id: 'first-study-note', label: 'Complete your first study note' },
  { id: 'create-folder', label: 'Create a folder' },
  { id: 'scan-note', label: 'Scan a handwritten note' },
  { id: 'lamplight-connections', label: 'Explore Lamplight connections' },
  { id: 'visit-graph', label: 'Visit your connections graph' },
  { id: 'streak-3', label: 'Study 3 days in a row' },
  { id: 'search-notes', label: 'Search your notes' },
];
