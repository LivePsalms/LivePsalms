// Node-testable structural invariants for the DevotionMoodBoard data model.
// These assert the SHAPE of the data (no React/GSAP render): every image
// resolves on disk, every devotion follows the canonical role arc, every text
// element carries a `full` body, and every background is a valid BlendRecipe.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  moodBoards,
  CANONICAL_ROLE_ARC,
  collectImageSources,
  collectSectionTexts,
  collectBlendRecipes,
  isValidBlendRecipe,
} from './devotion-moodboards';

const publicDir = path.join(process.cwd(), 'public');
const boards = Object.values(moodBoards);

describe('DevotionMoodBoard data model', () => {
  it('has at least the Peace devotion migrated', () => {
    expect(moodBoards.peace).toBeDefined();
    expect(boards.length).toBeGreaterThan(0);
  });

  it('every section image src resolves to a file under /public', () => {
    const missing: string[] = [];
    for (const board of boards) {
      for (const src of collectImageSources(board)) {
        if (!existsSync(path.join(publicDir, src.replace(/^\//, '')))) {
          missing.push(`${board.id}: ${src}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('every devotion presents the canonical role arc in order', () => {
    for (const board of boards) {
      const roles = board.sections.map((s) => s.role);
      expect(roles).toEqual(CANONICAL_ROLE_ARC);
    }
  });

  it('every text element has a full body (mobile may inherit full)', () => {
    const empty: string[] = [];
    for (const board of boards) {
      for (const { where, text } of collectSectionTexts(board)) {
        if (text.full === undefined || text.full === null || text.full === '') {
          empty.push(`${board.id}: ${where}`);
        }
      }
    }
    expect(empty).toEqual([]);
  });

  it('every background is a valid BlendRecipe', () => {
    const bad: string[] = [];
    for (const board of boards) {
      for (const { where, recipe } of collectBlendRecipes(board)) {
        if (!isValidBlendRecipe(recipe)) {
          bad.push(`${board.id}: ${where} -> ${JSON.stringify(recipe)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
