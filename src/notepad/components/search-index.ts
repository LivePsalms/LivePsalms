import type { Note } from '../types';
import { extractTextFromNote } from '../utils/tiptap-text';
import { extractVerseRefs } from '../extensions/bible-verse-utils';

export interface SearchIndexVerseEntry {
  ref: string;
  noteId: string;
  noteTitle: string;
}

export interface SearchIndexTagEntry {
  tag: string;
  noteId: string;
  noteTitle: string;
}

export interface SearchIndex {
  verses: SearchIndexVerseEntry[];
  tags: SearchIndexTagEntry[];
}

export function buildSearchIndex(notes: Note[]): SearchIndex {
  const verses = new Map<string, SearchIndexVerseEntry>();
  const tags = new Map<string, SearchIndexTagEntry>();

  for (const note of notes) {
    const text = extractTextFromNote(note);
    for (const ref of extractVerseRefs(text)) {
      if (!verses.has(ref)) {
        verses.set(ref, { ref, noteId: note.id, noteTitle: note.title });
      }
    }
    for (const tag of note.tags) {
      if (!tags.has(tag)) {
        tags.set(tag, { tag, noteId: note.id, noteTitle: note.title });
      }
    }
  }

  return {
    verses: [...verses.values()],
    tags: [...tags.values()],
  };
}
