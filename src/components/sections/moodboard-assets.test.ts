// Regression guard: every public image path referenced in MoodBoard.tsx must
// resolve to a file that actually exists under /public. This catches the class
// of bug where an asset reorg (renaming /restoration1/hf_*.png -> image*.png)
// updates the desktop zones but leaves a mobile image map pointing at deleted
// filenames — which renders as broken images on mobile only.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
// All devotions carry their image paths in src/data/devotion-moodboards/
// (one file per board). MoodBoard.tsx + the barrel are still scanned for any
// stray fallback/default image paths that live outside the per-board files.
const moodboardDir = path.join(repoRoot, 'src/data/devotion-moodboards');
const moodboardSources = [
  path.join(repoRoot, 'src/components/sections/MoodBoard.tsx'),
  path.join(repoRoot, 'src/data/devotion-moodboards.tsx'),
  ...readdirSync(moodboardDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map((f) => path.join(moodboardDir, f)),
];
const publicDir = path.join(repoRoot, 'public');

// Match single- or double-quoted absolute public paths ending in an image ext.
const IMAGE_PATH_RE = /['"](\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp))['"]/g;

function referencedImagePaths(source: string): string[] {
  const paths = new Set<string>();
  for (const match of source.matchAll(IMAGE_PATH_RE)) {
    paths.add(match[1]);
  }
  return [...paths].sort();
}

describe('MoodBoard image assets', () => {
  const source = moodboardSources.map((f) => readFileSync(f, 'utf8')).join('\n');
  const paths = referencedImagePaths(source);

  it('references at least one image (sanity check the extractor works)', () => {
    expect(paths.length).toBeGreaterThan(0);
  });

  it('every referenced public image exists on disk', () => {
    const missing = paths.filter(
      (p) => !existsSync(path.join(publicDir, p.replace(/^\//, ''))),
    );
    expect(missing).toEqual([]);
  });
});
