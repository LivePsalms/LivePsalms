// scripts/build-style-assets.mjs
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import {
  categorize,
  slugify,
  buildManifestEntry,
  renderManifestModule,
} from './style-assets-lib.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const SRC = arg('src', '../Notes Styles');
const OUT = arg('out', 'public/styles');
const MANIFEST = arg('manifest', 'src/notepad/styles/manifest.ts');

const DISPLAY_EDGE = 800;
const THUMB_EDGE = 120;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function run() {
  const entries = [];
  const seen = new Set();

  for await (const file of walk(SRC)) {
    if (!/\.(png|jpe?g)$/i.test(file)) continue;
    const rel = relative(SRC, file).split('\\').join('/');
    const folder = rel.slice(0, rel.lastIndexOf('/'));
    const category = categorize(folder);
    if (!category) continue;

    const filename = rel.slice(rel.lastIndexOf('/') + 1);
    let id = slugify(filename, category);
    // Guarantee uniqueness if two source files slug-collide.
    let n = 2;
    while (seen.has(id)) id = `${slugify(filename, category)}-${n++}`;
    seen.add(id);

    const dir = join(OUT, category);
    await mkdir(dir, { recursive: true });

    const img = sharp(file);
    const meta = await img.metadata();

    await sharp(file)
      .resize({ width: DISPLAY_EDGE, height: DISPLAY_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(dir, `${id}.webp`));

    await sharp(file)
      .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(join(dir, `${id}.thumb.webp`));

    entries.push(
      buildManifestEntry({
        id,
        category,
        width: meta.width ?? 1,
        height: meta.height ?? 1,
      }),
    );
  }

  await writeFile(MANIFEST, renderManifestModule(entries), 'utf8');
  console.log(`Wrote ${entries.length} assets and ${MANIFEST}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
