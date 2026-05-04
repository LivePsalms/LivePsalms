/**
 * One-time build script: converts OpenBible.info cross-references TSV
 * to a JSON lookup keyed by canonical scripture ID.
 *
 * Usage: npx tsx scripts/build-tsk-data.ts
 *
 * Input: downloads cross_references.txt from GitHub (scrollmapper/bible_databases)
 * Output: src/notepad/graph/tsk-data.json
 */

import { writeFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

// These abbreviations MUST match edge-parser.ts BOOK_ABBREVS output.
// edge-parser takes the shortest name from each BOOK_PATTERNS entry, lowercased, no spaces/dots.
const BOOK_MAP: Record<string, string> = {
  'Gen': 'gen', 'Exod': 'ex', 'Lev': 'lev', 'Num': 'num', 'Deut': 'dt',
  'Josh': 'jos', 'Judg': 'jdg', 'Ruth': 'ruth',
  '1Sam': '1sa', '2Sam': '2sa', '1Kgs': '1ki', '2Kgs': '2ki',
  '1Chr': '1ch', '2Chr': '2ch', 'Ezra': 'ezra', 'Neh': 'neh', 'Esth': 'est',
  'Job': 'job', 'Ps': 'ps', 'Prov': 'pr', 'Eccl': 'ecc',
  'Song': 'ss', 'Isa': 'isa', 'Jer': 'jer', 'Lam': 'lam',
  'Ezek': 'eze', 'Dan': 'da', 'Hos': 'hos', 'Joel': 'joe',
  'Amos': 'amos', 'Obad': 'ob', 'Jonah': 'jon', 'Mic': 'mic',
  'Nah': 'nah', 'Hab': 'hab', 'Zeph': 'zep', 'Hag': 'hag',
  'Zech': 'zec', 'Mal': 'mal',
  'Matt': 'mt', 'Mark': 'mk', 'Luke': 'lk', 'John': 'jn',
  'Acts': 'acts', 'Rom': 'ro', '1Cor': '1co', '2Cor': '2co',
  'Gal': 'gal', 'Eph': 'eph', 'Phil': 'phil', 'Col': 'col',
  '1Thess': '1th', '2Thess': '2th', '1Tim': '1ti', '2Tim': '2ti',
  'Titus': 'tit', 'Phlm': 'phm', 'Heb': 'heb', 'Jas': 'jas',
  '1Pet': '1pe', '2Pet': '2pe', '1John': '1jn', '2John': '2jn', '3John': '3jn',
  'Jude': 'jude', 'Rev': 're',
};

function openBibleRefToCanonicalId(ref: string): string | null {
  // Format: "Gen.1.1" or "Prov.8.22"
  const parts = ref.split('.');
  if (parts.length < 3) return null;
  const book = parts[0];
  const chapter = parts[1];
  const verse = parts[2];
  const abbrev = BOOK_MAP[book];
  if (!abbrev) return null;
  return `${abbrev}-${chapter}-${verse}`;
}

async function main() {
  const url = 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/extras/cross_references.txt';
  console.log('Downloading cross-references from OpenBible.info...');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  const text = await response.text();

  const lines = text.split('\n');
  const lookup: Record<string, string[]> = {};

  let processed = 0;
  let skipped = 0;

  for (const line of lines) {
    if (line.startsWith('From Verse') || line.startsWith('#') || !line.trim()) continue;

    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const fromRef = parts[0].trim();
    const toRef = parts[1].trim();

    // Handle ranges: "Prov.8.22-Prov.8.30" -> just use start verse
    const fromClean = fromRef.includes('-') ? fromRef.split('-')[0] : fromRef;
    const toClean = toRef.includes('-') ? toRef.split('-')[0] : toRef;

    const fromId = openBibleRefToCanonicalId(fromClean);
    const toId = openBibleRefToCanonicalId(toClean);

    if (!fromId || !toId) {
      skipped++;
      continue;
    }

    if (!lookup[fromId]) lookup[fromId] = [];
    if (!lookup[fromId].includes(toId)) {
      lookup[fromId].push(toId);
    }

    processed++;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const outputPath = resolve(__dirname, '../src/notepad/graph/tsk-data.json');
  writeFileSync(outputPath, JSON.stringify(lookup));

  const stats = statSync(outputPath);
  console.log(`Done! Processed ${processed} cross-references, skipped ${skipped}.`);
  console.log(`Output: src/notepad/graph/tsk-data.json`);
  console.log(`Unique source verses: ${Object.keys(lookup).length}`);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error);
