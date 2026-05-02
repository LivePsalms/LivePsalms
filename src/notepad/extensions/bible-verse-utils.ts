// Bible book patterns: each entry is a pipe-separated list of accepted names/abbreviations
export const BOOK_PATTERNS: string[] = [
  // Old Testament
  'Genesis|Gen',
  'Exodus|Exod|Ex',
  'Leviticus|Lev',
  'Numbers|Num',
  'Deuteronomy|Deut|Dt',
  'Joshua|Josh|Jos',
  'Judges|Judg|Jdg',
  'Ruth',
  '1 Samuel|1 Sam|1Sa',
  '2 Samuel|2 Sam|2Sa',
  '1 Kings|1 Kgs|1Ki',
  '2 Kings|2 Kgs|2Ki',
  '1 Chronicles|1 Chron|1 Chr|1Ch',
  '2 Chronicles|2 Chron|2 Chr|2Ch',
  'Ezra',
  'Nehemiah|Neh',
  'Esther|Esth|Est',
  'Job',
  'Psalms?|Ps',
  'Proverbs|Prov|Pr',
  'Ecclesiastes|Eccles|Eccl|Ecc',
  'Song of Solomon|Song of Songs|Song|SOS|SS',
  'Isaiah|Isa',
  'Jeremiah|Jer',
  'Lamentations|Lam',
  'Ezekiel|Ezek|Eze',
  'Daniel|Dan|Da',
  'Hosea|Hos',
  'Joel|Joe',
  'Amos',
  'Obadiah|Obad|Ob',
  'Jonah|Jon',
  'Micah|Mic',
  'Nahum|Nah',
  'Habakkuk|Hab',
  'Zephaniah|Zeph|Zep',
  'Haggai|Hag',
  'Zechariah|Zech|Zec',
  'Malachi|Mal',
  // New Testament
  'Matthew|Matt|Mt',
  'Mark|Mk',
  'Luke|Lk',
  'John|Jn',
  'Acts',
  'Romans|Rom|Ro',
  '1 Corinthians|1 Cor|1Co',
  '2 Corinthians|2 Cor|2Co',
  'Galatians|Gal',
  'Ephesians|Eph',
  'Philippians|Phil',
  'Colossians|Col',
  '1 Thessalonians|1 Thess|1 Thes|1Th',
  '2 Thessalonians|2 Thess|2 Thes|2Th',
  '1 Timothy|1 Tim|1Ti',
  '2 Timothy|2 Tim|2Ti',
  'Titus|Tit',
  'Philemon|Phlm|Phm',
  'Hebrews|Heb',
  'James|Jas',
  '1 Peter|1 Pet|1Pe',
  '2 Peter|2 Pet|2Pe',
  '1 John|1 Jn|1Jn',
  '2 John|2 Jn|2Jn',
  '3 John|3 Jn|3Jn',
  'Jude',
  'Revelation|Rev|Re',
];

// Build a regex group that matches any book name or abbreviation
const bookGroup = `(?:${BOOK_PATTERNS.join('|')})`;

// Verse range suffix: optional "-30" or "–30"
const rangeSuffix = `(?:\\s*[-–]\\s*\\d{1,3})?`;

// Core pattern (no anchors, no capturing group)
const corePattern = `${bookGroup}\\s+\\d{1,3}:\\d{1,3}${rangeSuffix}`;

// Core pattern with a capturing group around the whole match (for input/paste rules)
const corePatternCapturing = `(${bookGroup}\\s+\\d{1,3}:\\d{1,3}${rangeSuffix})`;

/**
 * Global regex for finding verse references anywhere in a string.
 * Example matches: "Romans 8:28", "1 Peter 5:7", "Gen 22:8", "Ps 23:1-6"
 */
export const VERSE_REGEX = new RegExp(corePattern, 'g');

/**
 * Anchored regex for TipTap input rules (end-of-input detection).
 * Must end with "$" and have a capturing group.
 */
export const VERSE_INPUT_REGEX = new RegExp(`${corePatternCapturing}$`);

/**
 * Global regex with capturing group for TipTap paste rules.
 */
export const VERSE_PASTE_REGEX = new RegExp(corePatternCapturing, 'g');

/**
 * Normalizes a verse reference for use in the bible-api.com URL.
 * Example: "Romans 8:28" → "Romans+8:28"
 */
export function normalizeVerseRef(ref: string): string {
  return ref.trim().replace(/\s+/g, '+');
}

export interface VerseResult {
  text: string;
  reference: string;
  translation: string;
}

/**
 * Fetches verse text from bible-api.com.
 * Returns { text, reference, translation } or null on error.
 */
export async function fetchVerseText(ref: string): Promise<VerseResult | null> {
  try {
    const normalized = normalizeVerseRef(ref);
    const response = await fetch(`https://bible-api.com/${normalized}`);
    if (!response.ok) return null;
    const data = await response.json() as {
      text?: string;
      reference?: string;
      translation_name?: string;
    };
    if (!data.text || !data.reference) return null;
    return {
      text: data.text.trim(),
      reference: data.reference,
      translation: data.translation_name ?? 'WEB',
    };
  } catch {
    return null;
  }
}

/**
 * Extracts all unique verse references found in the given text.
 */
export function extractVerseRefs(text: string): string[] {
  const regex = new RegExp(VERSE_REGEX.source, 'g');
  const matches = text.match(regex);
  if (!matches) return [];
  return [...new Set(matches)];
}
