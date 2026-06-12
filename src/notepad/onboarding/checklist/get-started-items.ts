// src/notepad/onboarding/checklist/get-started-items.ts
import type { AnonItemId } from '../onboarding-types';

export interface ChecklistItemDef<Id extends string> {
  id: Id;
  label: string;
  hint?: string;
}

export const GET_STARTED_ITEMS: ChecklistItemDef<AnonItemId>[] = [
  { id: 'write-first-note', label: 'Write your first note' },
  { id: 'link-verse', label: 'Link a verse' },
  { id: 'highlight', label: 'Highlight something' },
  { id: 'create-account', label: 'Create an account', hint: 'Save your work across devices' },
];
