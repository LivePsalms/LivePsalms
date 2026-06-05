// Data-driven devotion moodboards — directory barrel.
//
// The model + renderer-facing/test-facing helpers live in
// ./devotion-moodboards/_shared. Each devotion is ONE object with TWO
// art-directed arrangements (desktop `sections`, mobile `mobile`) sharing prose
// via SectionText {full, mobile?}. Individual boards live in sibling files
// (peace.tsx, hope.tsx, …) and are assembled into `moodBoards` here.
//
// The import path `@/data/devotion-moodboards` is unchanged: consumers (the
// MoodBoard renderer, the data test) import types/helpers/moodBoards from here.
//
// Migration status: all 11 devotions migrated. MoodBoardZones / MoodBoardStack
// in MoodBoard.tsx render every devotion from these data objects.
export * from './devotion-moodboards/_shared';

import type { DevotionMoodBoard } from './devotion-moodboards/_shared';
import { peaceBoard } from './devotion-moodboards/peace';
import { hopeBoard } from './devotion-moodboards/hope';
import { strengthBoard } from './devotion-moodboards/strength';
import { wholenessBoard } from './devotion-moodboards/wholeness';
import { purposeBoard } from './devotion-moodboards/purpose';
import { connectionBoard } from './devotion-moodboards/connection';
import { identityBoard } from './devotion-moodboards/identity';
import { joyBoard } from './devotion-moodboards/joy';
import { forgivenessBoard } from './devotion-moodboards/forgiveness';
import { surrenderBoard } from './devotion-moodboards/surrender';
import { trustBoard } from './devotion-moodboards/trust';

export const moodBoards: Record<string, DevotionMoodBoard> = {
  peace: peaceBoard,
  hope: hopeBoard,
  strength: strengthBoard,
  wholeness: wholenessBoard,
  purpose: purposeBoard,
  connection: connectionBoard,
  identity: identityBoard,
  joy: joyBoard,
  forgiveness: forgivenessBoard,
  surrender: surrenderBoard,
  trust: trustBoard,
};
