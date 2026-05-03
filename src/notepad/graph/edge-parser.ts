import { VERSE_REGEX, BOOK_PATTERNS } from '../extensions/bible-verse-utils';

interface ParsedEdge {
  target: string;
  type: 'explicit' | 'scripture_reference';
  weight: number;
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
  const match = trimmed.match(/^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-\u2013]\s*(\d{1,3}))?$/);
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
  const match = ref.trim().match(/^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-\u2013]\s*(\d{1,3}))?$/);
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

function extractNoteLinks(doc: unknown): Array<{ noteId: string }> {
  const links: Array<{ noteId: string }> = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n.type === 'text' && Array.isArray(n.marks)) {
      for (const mark of n.marks) {
        const m = mark as Record<string, unknown>;
        if (m.type === 'noteLink') {
          const attrs = m.attrs as Record<string, unknown> | undefined;
          if (attrs?.noteId && typeof attrs.noteId === 'string') {
            links.push({ noteId: attrs.noteId });
          }
        }
      }
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(doc);
  return links;
}

export function parseEdgesFromContent(
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

  const noteLinks = extractNoteLinks(doc);
  for (const link of noteLinks) {
    const key = `explicit:${link.noteId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ target: link.noteId, type: 'explicit', weight: 1.0 });
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

  return { edges, scriptureRefs };
}
