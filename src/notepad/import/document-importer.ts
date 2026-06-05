import { v4 as uuidv4 } from 'uuid';
import { extractVerseRefs } from '../extensions/bible-verse-utils';
import { countWordsFromTipTapJSON, extractTextFromNote } from '../utils/tiptap-text';
import type { Note } from '../types';

/**
 * DocumentImporter — parses uploaded files into full `Note` records, ready
 * for `adapter.importNote` (id-preserving). Three exports:
 *
 *   - `parseFile(file)` — async, format-aware (.md, .txt, .pdf, .docx). DOM-coupled.
 *   - `buildNoteFromText(...)` — sync, pure. Plain text → `Note` (with
 *     client-generated id, timestamps, wordCount, optional verse-ref tags).
 *   - `linkNotesByVerses(notes)` — sync, pure. Optional cross-link pass that
 *     appends a "Related Notes" section pointing at each peer that shares at
 *     least one verse reference, using real `noteLink` marks. Because the ids
 *     exist before the linking pass runs, these become actual Reference edges
 *     once the notes are synced into `ReferenceGraph` — i.e. proper Backlinks.
 */

const MAX_AUTO_TAGS = 10;

export interface BuildNoteOpts {
  title: string;
  text: string;
  folderId: string;
  /** Default `'devotion'` to match prior import behavior. */
  type?: Note['type'];
  /** When true, scrape verse references out of the plain text and use them as tags (capped at 10). */
  autoDetectVerses?: boolean;
}

/**
 * Parses a File into plain text, branching on extension. Async because PDF and
 * DOCX support is loaded on demand. Returns `''` for unrecognized formats.
 *
 * Not unit-tested — depends on browser File APIs and dynamically imports
 * `pdfjs-dist` and `mammoth`. Smoke-tested via the upload UI.
 */
export async function parseFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'md' || ext === 'txt') {
    return file.text();
  }

  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pages.push(pageText);
    }
    return pages.join('\n\n');
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const buffer = await file.arrayBuffer();
    // mammoth.extractRawText feeds the plain-text paragraph builder, which
    // splits on double newlines.
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  return '';
}

/**
 * Builds a full `Note` from plain text. Generates `id` (`uuidv4`),
 * `createdAt`/`updatedAt` (now), and `wordCount`. The id is generated
 * client-side so an optional cross-link pass (`linkNotesByVerses`) can refer
 * to peers by their final id. Splits paragraphs on `\n\n+`, drops empty
 * paragraphs, wraps each in a TipTap `paragraph` node.
 */
export function buildNoteFromText(opts: BuildNoteOpts): Note {
  const paragraphs = opts.text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const doc = {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  };

  const content = JSON.stringify(doc);
  const tags = opts.autoDetectVerses
    ? extractVerseRefs(opts.text).slice(0, MAX_AUTO_TAGS)
    : [];

  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: opts.title,
    content,
    folderId: opts.folderId,
    type: opts.type ?? 'devotion',
    tags,
    wordCount: countWordsFromTipTapJSON(content),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * For each pair of notes that share at least one verse reference, appends a
 * "Related Notes" section pointing at each peer with a real `noteLink` mark.
 * Returns a new array; does not mutate inputs.
 */
export function linkNotesByVerses(notes: Note[]): Note[] {
  if (notes.length < 2) return notes.slice();

  const noteRefs = notes.map((n) => new Set(extractVerseRefs(extractTextFromNote(n))));

  return notes.map((note, i) => {
    const related: Note[] = [];
    noteRefs.forEach((refs, j) => {
      if (j === i) return;
      const shared = [...noteRefs[i]].some((r) => refs.has(r));
      if (shared) related.push(notes[j]);
    });
    return appendRelatedNoteLinks(note, related);
  });
}

export interface FilesToNotesOpts {
  folderId: string;
  /** When true, scrape verse references out of the plain text and use them as tags (capped at 10). */
  autoDetectVerses?: boolean;
  /** When true, append a cross-linking "Related Notes" pass via linkNotesByVerses. */
  autoCreateLinks?: boolean;
}

/**
 * Orchestrates the full upload import: parse each File to text, build a Note
 * per file (title = filename without extension), then optionally cross-link by
 * shared verse refs. Returns Notes ready for `importNotes`. Shared by the
 * desktop UploadModal and the mobile FAB upload flow.
 */
export async function filesToNotes(
  files: File[],
  opts: FilesToNotesOpts,
): Promise<Note[]> {
  const { folderId, autoDetectVerses = false, autoCreateLinks = false } = opts;
  const parsed = await Promise.all(
    files.map(async (file) => {
      const text = await parseFile(file);
      const title = file.name.replace(/\.[^.]+$/, '');
      return { title, text };
    }),
  );
  let notes = parsed.map(({ title, text }) =>
    buildNoteFromText({ title, text, folderId, autoDetectVerses }),
  );
  if (autoCreateLinks) {
    notes = linkNotesByVerses(notes);
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function appendRelatedNoteLinks(note: Note, related: Note[]): Note {
  if (related.length === 0) return note;

  try {
    const doc = JSON.parse(note.content) as { type: string; content: unknown[] };

    const headingNode = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Related Notes', marks: [{ type: 'bold' }] }],
    };

    const linkNodes = related.map((target) => ({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: target.title,
          marks: [
            { type: 'noteLink', attrs: { noteId: target.id, noteTitle: target.title } },
          ],
        },
      ],
    }));

    const updatedDoc = {
      ...doc,
      content: [...(doc.content ?? []), headingNode, ...linkNodes],
    };

    const updatedContent = JSON.stringify(updatedDoc);
    return {
      ...note,
      content: updatedContent,
      wordCount: countWordsFromTipTapJSON(updatedContent),
    };
  } catch {
    return note;
  }
}
