// Regression guard: every public image path referenced in MoodBoard.tsx must
// resolve to a file that actually exists under /public. This catches the class
// of bug where an asset reorg (renaming /restoration1/hf_*.png -> image*.png)
// updates the desktop zones but leaves a mobile image map pointing at deleted
// filenames — which renders as broken images on mobile only.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const moodboardSource = path.join(repoRoot, 'src/components/sections/MoodBoard.tsx');
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
  const source = readFileSync(moodboardSource, 'utf8');
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
