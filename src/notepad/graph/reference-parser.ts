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
  'Psalms|Psalm|Ps',
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

/**
 * Global regex for finding verse references anywhere in a string.
 * Example matches: "Romans 8:28", "1 Peter 5:7", "Gen 22:8", "Ps 23:1-6"
 */
export const VERSE_REGEX = new RegExp(corePattern, 'g');

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
 * Optional `signal` lets callers cancel a stale request (e.g. on hover changes).
 */
export async function fetchVerseText(
  ref: string,
  options?: { signal?: AbortSignal },
): Promise<VerseResult | null> {
  try {
    const normalized = normalizeVerseRef(ref);
    const response = await fetch(`https://bible-api.com/${normalized}`, {
      signal: options?.signal,
    });
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

const BOOK_ABBREVS: Map<string, string> = new Map();
for (const pattern of BOOK_PATTERNS) {
  const names = pattern.split('|');
  const shortest = names.reduce((a, b) => (a.length <= b.length ? a : b));
  const abbrev = shortest.toLowerCase().replace(/[\s.]/g, '');
  for (const name of names) {
    BOOK_ABBREVS.set(name.toLowerCase().replace(/[\s.]/g, ''), abbrev);
  }
}

export function toCanonicalScriptureId(ref: string): string {
  const trimmed = ref.trim();
  const match = trimmed.match(/^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/);
  if (!match) return `scripture:unknown`;

  const bookRaw = match[1];
  const chapter = match[2];
  const verseStart = match[3];

  const bookKey = bookRaw.toLowerCase().replace(/[\s.]/g, '');
  const abbrev = BOOK_ABBREVS.get(bookKey) ?? bookKey;

  return `scripture:${abbrev}-${chapter}-${verseStart}`;
}

export function parseVerseRef(ref: string): {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
} | null {
  const match = ref.trim().match(/^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/);
  if (!match) return null;

  const bookKey = match[1].toLowerCase().replace(/[\s.]/g, '');
  let canonicalBook = match[1];
  for (const pattern of BOOK_PATTERNS) {
    const names = pattern.split('|');
    for (const name of names) {
      if (name.toLowerCase().replace(/[\s.]/g, '') === bookKey) {
        canonicalBook = names[0];
        break;
      }
    }
  }

  return {
    book: canonicalBook,
    chapter: parseInt(match[2], 10),
    verseStart: parseInt(match[3], 10),
    verseEnd: match[4] ? parseInt(match[4], 10) : null,
  };
}

// Private helpers

function extractPlainText(doc: unknown): string {
  const parts: string[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n.type === 'text' && typeof n.text === 'string') {
      parts.push(n.text);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(doc);
  return parts.join(' ');
}

export function walkMarks(doc: unknown, markType: string): Array<Record<string, unknown>> {
  const found: Array<Record<string, unknown>> = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n.type === 'text' && Array.isArray(n.marks)) {
      for (const mark of n.marks) {
        const m = mark as Record<string, unknown>;
        if (m.type === markType) found.push(m);
      }
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(doc);
  return found;
}

/**
 * Builds a snippet around the first `noteLink` mark in `content` that targets
 * `noteId`. Returns the marked text wrapped in [brackets] inside up to
 * `windowChars` characters of surrounding plain text from the same top-level
 * block, with leading/trailing ellipses where truncated. Returns null if the
 * content is not parseable JSON or no matching mark is found.
 */
export function findNoteLinkSnippet(
  content: string,
  noteId: string,
  windowChars = 60,
): string | null {
  if (!content) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  function blockText(node: unknown): string {
    if (!node || typeof node !== 'object') return '';
    const n = node as Record<string, unknown>;
    if (n.type === 'text' && typeof n.text === 'string') return n.text;
    if (Array.isArray(n.content)) return n.content.map(blockText).join('');
    return '';
  }

  function findMarkText(node: unknown): string | null {
    if (!node || typeof node !== 'object') return null;
    const n = node as Record<string, unknown>;
    if (n.type === 'text' && Array.isArray(n.marks)) {
      for (const mark of n.marks) {
        const m = mark as Record<string, unknown>;
        const attrs = m.attrs as Record<string, unknown> | undefined;
        if (m.type === 'noteLink' && attrs?.noteId === noteId) {
          return typeof n.text === 'string' ? n.text : '';
        }
      }
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        const found = findMarkText(child);
        if (found !== null) return found;
      }
    }
    return null;
  }

  const root = parsed as Record<string, unknown>;
  const blocks = Array.isArray(root.content) ? root.content : [];

  for (const block of blocks) {
    const markedText = findMarkText(block);
    if (markedText === null) continue;
    const text = blockText(block);
    if (!markedText) {
      const trimmed = text.slice(0, windowChars * 2);
      return trimmed + (text.length > trimmed.length ? '…' : '');
    }
    const idx = text.indexOf(markedText);
    if (idx === -1) {
      const trimmed = text.slice(0, windowChars * 2);
      return trimmed + (text.length > trimmed.length ? '…' : '');
    }
    const start = Math.max(0, idx - windowChars);
    const end = Math.min(text.length, idx + markedText.length + windowChars);
    const before = (start > 0 ? '…' : '') + text.slice(start, idx);
    const after = text.slice(idx + markedText.length, end) + (end < text.length ? '…' : '');
    return `${before}[${markedText}]${after}`;
  }

  return null;
}

export interface ParsedEdge {
  target: string;
  type: 'explicit' | 'scripture_reference' | 'cross_reference';
  weight: number;
}

export function parseReferencesFromContent(
  noteId: string,
  content: string
): { edges: ParsedEdge[]; scriptureRefs: Array<{ id: string; ref: string }> } {
  if (!content) return { edges: [], scriptureRefs: [] };

  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return { edges: [], scriptureRefs: [] };
  }

  const edges: ParsedEdge[] = [];
  const scriptureRefs: Array<{ id: string; ref: string }> = [];
  const seen = new Set<string>();

  const noteLinks = walkMarks(doc, 'noteLink');
  for (const m of noteLinks) {
    const attrs = m.attrs as Record<string, unknown> | undefined;
    if (attrs?.noteId && typeof attrs.noteId === 'string') {
      const key = `explicit:${attrs.noteId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ target: attrs.noteId, type: 'explicit', weight: 1.0 });
    }
  }

  const plainText = extractPlainText(doc);
  const verseRegex = new RegExp(VERSE_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = verseRegex.exec(plainText)) !== null) {
    const ref = match[0];
    const scriptureId = toCanonicalScriptureId(ref);
    const key = `scripture_reference:${scriptureId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ target: scriptureId, type: 'scripture_reference', weight: 0.9 });
    scriptureRefs.push({ id: scriptureId, ref });
  }

  // noteId param reserved for future use (e.g. self-edge filtering)
  void noteId;

  return { edges, scriptureRefs };
}
