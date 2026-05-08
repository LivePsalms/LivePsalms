import { describe, it, expect } from 'vitest';
import {
  buildNoteFromText,
  linkNotesByVerses,
} from './document-importer';
import { extractTextFromNote } from '../utils/tiptap-text';
import type { Note } from '../types';

// ---------------------------------------------------------------------------
// Helpers — peek at TipTap JSON
// ---------------------------------------------------------------------------

interface TextNode {
  type: 'text';
  text: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}
interface BlockNode {
  type: string;
  content?: Array<TextNode | BlockNode>;
}

function parseDoc(content: string): BlockNode {
  return JSON.parse(content) as BlockNode;
}

function flattenTextNodes(node: BlockNode | TextNode): TextNode[] {
  if (node.type === 'text') return [node as TextNode];
  if ('content' in node && Array.isArray(node.content)) {
    return node.content.flatMap(flattenTextNodes);
  }
  return [];
}

// ---------------------------------------------------------------------------
// buildNoteFromText
// ---------------------------------------------------------------------------

describe('buildNoteFromText — content building', () => {
  it('returns a Note with empty doc.content for empty text', () => {
    const note = buildNoteFromText({ title: 't', text: '', folderId: 'root' });
    const doc = parseDoc(note.content);
    expect(doc).toEqual({ type: 'doc', content: [] });
  });

  it('wraps a single paragraph as one TipTap paragraph node', () => {
    const note = buildNoteFromText({
      title: 't',
      text: 'A single paragraph of prose.',
      folderId: 'root',
    });
    const doc = parseDoc(note.content);
    expect(doc.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'A single paragraph of prose.' }] },
    ]);
  });

  it('splits paragraphs on `\\n\\n+` and drops empty ones', () => {
    const note = buildNoteFromText({
      title: 't',
      text: 'First.\n\nSecond.\n\n\n\nThird.',
      folderId: 'root',
    });
    const doc = parseDoc(note.content);
    expect(doc.content?.flatMap(flattenTextNodes).map((t) => t.text)).toEqual([
      'First.',
      'Second.',
      'Third.',
    ]);
  });

  it('trims each paragraph', () => {
    const note = buildNoteFromText({
      title: 't',
      text: '  leading and trailing  \n\n  another  ',
      folderId: 'root',
    });
    const doc = parseDoc(note.content);
    expect(doc.content?.flatMap(flattenTextNodes).map((t) => t.text)).toEqual([
      'leading and trailing',
      'another',
    ]);
  });
});

describe('buildNoteFromText — Note fields', () => {
  it('preserves title and folderId', () => {
    const n = buildNoteFromText({ title: 'My title', text: '', folderId: 'f1' });
    expect(n.title).toBe('My title');
    expect(n.folderId).toBe('f1');
  });

  it("defaults `type` to 'devotion'", () => {
    const n = buildNoteFromText({ title: 't', text: '', folderId: 'root' });
    expect(n.type).toBe('devotion');
  });

  it('honors a non-default `type`', () => {
    const n = buildNoteFromText({ title: 't', text: '', folderId: 'root', type: 'sermon' });
    expect(n.type).toBe('sermon');
  });

  it('generates a non-empty `id`', () => {
    const a = buildNoteFromText({ title: 't', text: '', folderId: 'root' });
    const b = buildNoteFromText({ title: 't', text: '', folderId: 'root' });
    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('sets createdAt === updatedAt to the current ISO instant', () => {
    const before = Date.now();
    const n = buildNoteFromText({ title: 't', text: '', folderId: 'root' });
    const after = Date.now();
    const stamp = Date.parse(n.createdAt);
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(after);
    expect(n.updatedAt).toBe(n.createdAt);
  });

  it('computes wordCount from the TipTap content', () => {
    const empty = buildNoteFromText({ title: 't', text: '', folderId: 'root' });
    expect(empty.wordCount).toBe(0);

    const five = buildNoteFromText({
      title: 't',
      text: 'one two three four five',
      folderId: 'root',
    });
    expect(five.wordCount).toBe(5);
  });
});

describe('buildNoteFromText — auto-detect verses', () => {
  it('returns empty tags when autoDetectVerses is false or absent', () => {
    const n = buildNoteFromText({
      title: 't',
      text: 'See Romans 8:28 and 1 Peter 5:7.',
      folderId: 'root',
    });
    expect(n.tags).toEqual([]);
  });

  it('extracts verse refs as tags when autoDetectVerses is true', () => {
    const n = buildNoteFromText({
      title: 't',
      text: 'See Romans 8:28 and 1 Peter 5:7.',
      folderId: 'root',
      autoDetectVerses: true,
    });
    expect(n.tags).toEqual(expect.arrayContaining(['Romans 8:28', '1 Peter 5:7']));
  });

  it('caps auto-detected tags at 10', () => {
    const refs = Array.from({ length: 15 }, (_, i) => `Psalms ${i + 1}:1`);
    const n = buildNoteFromText({
      title: 't',
      text: refs.join(' '),
      folderId: 'root',
      autoDetectVerses: true,
    });
    expect(n.tags).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// linkNotesByVerses
// ---------------------------------------------------------------------------

function noteWithText(title: string, text: string): Note {
  return buildNoteFromText({ title, text, folderId: 'root' });
}

function findNoteLinkMarks(note: Note): Array<{ noteId: string; noteTitle: string }> {
  const doc = parseDoc(note.content);
  return doc.content!.flatMap(flattenTextNodes).flatMap((t) => {
    if (!t.marks) return [];
    return t.marks
      .filter((m) => m.type === 'noteLink')
      .map((m) => ({
        noteId: String(m.attrs?.noteId ?? ''),
        noteTitle: String(m.attrs?.noteTitle ?? ''),
      }));
  });
}

describe('linkNotesByVerses', () => {
  it('returns notes unchanged when fewer than 2 are provided', () => {
    const single = [noteWithText('a', 'Romans 8:28')];
    const result = linkNotesByVerses(single);
    expect(result).toEqual(single);
    expect(result).not.toBe(single);
  });

  it('does not link two notes that share NO verse refs', () => {
    const a = noteWithText('A', 'No refs here.');
    const b = noteWithText('B', 'Also nothing.');
    const [resA, resB] = linkNotesByVerses([a, b]);
    expect(findNoteLinkMarks(resA)).toEqual([]);
    expect(findNoteLinkMarks(resB)).toEqual([]);
  });

  it('appends "Related Notes" with real noteLink marks pointing at peer ids', () => {
    const a = noteWithText('A', 'See Romans 8:28 today.');
    const b = noteWithText('B', 'Reflecting on Romans 8:28.');
    const [resA, resB] = linkNotesByVerses([a, b]);

    expect(extractTextFromNote(resA)).toContain('Related Notes');
    expect(findNoteLinkMarks(resA)).toEqual([{ noteId: b.id, noteTitle: 'B' }]);

    expect(extractTextFromNote(resB)).toContain('Related Notes');
    expect(findNoteLinkMarks(resB)).toEqual([{ noteId: a.id, noteTitle: 'A' }]);
  });

  it('uses the peer title as the marked text (not [[title]] plain text)', () => {
    const a = noteWithText('Alpha', 'Romans 8:28');
    const b = noteWithText('Beta', 'Romans 8:28');
    const [resA] = linkNotesByVerses([a, b]);
    const text = extractTextFromNote(resA);
    expect(text).toContain('Beta');
    expect(text).not.toContain('[[Beta]]');
  });

  it('handles a 3-way overlap: A↔B share, B↔C share, A↔C do not', () => {
    const a = noteWithText('A', 'Psalms 23:1');
    const b = noteWithText('B', 'Psalms 23:1 and Romans 8:28');
    const c = noteWithText('C', 'Romans 8:28');
    const [resA, resB, resC] = linkNotesByVerses([a, b, c]);

    expect(findNoteLinkMarks(resA).map((m) => m.noteTitle)).toEqual(['B']);
    expect(findNoteLinkMarks(resB).map((m) => m.noteTitle).sort()).toEqual(['A', 'C']);
    expect(findNoteLinkMarks(resC).map((m) => m.noteTitle)).toEqual(['B']);
  });

  it('does not mutate the input notes', () => {
    const a = noteWithText('A', 'Romans 8:28');
    const b = noteWithText('B', 'Romans 8:28');
    const aBefore = a.content;
    const bBefore = b.content;
    linkNotesByVerses([a, b]);
    expect(a.content).toBe(aBefore);
    expect(b.content).toBe(bBefore);
  });

  it('updates wordCount on linked notes (since content grew)', () => {
    const a = noteWithText('A', 'Romans 8:28');
    const b = noteWithText('Beta peer', 'Romans 8:28');
    const baseline = a.wordCount;
    const [resA] = linkNotesByVerses([a, b]);
    // "Related Notes" + "Beta peer" = +3 words
    expect(resA.wordCount).toBeGreaterThan(baseline);
  });
});
