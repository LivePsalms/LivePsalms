import { useEffect, useMemo, useState } from 'react';
import { BookOpen, FileText, Hash } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useNoteCollection } from '../context/useNoteCollection';
import { extractVerseRefs } from '../extensions/bible-verse-utils';

// Recursively extracts plain text from a TipTap JSON node
function extractText(node: Record<string, unknown>): string {
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractText).join(' ');
  }
  return '';
}

export function SearchDialog() {
  const { notes, collection } = useNoteCollection();
  const openNote = collection.openNote;
  const [open, setOpen] = useState(false);

  // Cmd+K / Ctrl+K toggles the dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Parse each note's content JSON and extract plain text + verse refs
  const searchData = useMemo(() => {
    return notes.map((note) => {
      let plainText = '';
      try {
        const json = JSON.parse(note.content) as Record<string, unknown>;
        plainText = extractText(json);
      } catch {
        plainText = note.content;
      }
      const verseRefs = extractVerseRefs(plainText);
      return { note, plainText, verseRefs };
    });
  }, [notes]);

  // Unique verse refs across all notes, each mapped to the first note that contains it
  const uniqueVerses = useMemo(() => {
    const seen = new Map<string, { ref: string; noteId: string; noteTitle: string }>();
    for (const { note, verseRefs } of searchData) {
      for (const ref of verseRefs) {
        if (!seen.has(ref)) {
          seen.set(ref, { ref, noteId: note.id, noteTitle: note.title });
        }
      }
    }
    return [...seen.values()];
  }, [searchData]);

  // Unique tags across all notes, each mapped to the first note that has it
  const uniqueTags = useMemo(() => {
    const seen = new Map<string, { tag: string; noteId: string; noteTitle: string }>();
    for (const { note } of searchData) {
      for (const tag of note.tags) {
        if (!seen.has(tag)) {
          seen.set(tag, { tag, noteId: note.id, noteTitle: note.title });
        }
      }
    }
    return [...seen.values()];
  }, [searchData]);

  const handleSelectNote = (id: string) => {
    openNote(id);
    setOpen(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search notes, verses, tags..."
    >
      <CommandInput placeholder="Search notes, verses, tags..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Notes">
          {notes.map((note) => (
            <CommandItem
              key={note.id}
              value={`note-${note.id}-${note.title}`}
              onSelect={() => handleSelectNote(note.id)}
            >
              <FileText style={{ color: 'var(--silica)' }} />
              <span>{note.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Verses">
          {uniqueVerses.map(({ ref, noteId, noteTitle }) => (
            <CommandItem
              key={`verse-${ref}`}
              value={`verse-${ref}`}
              onSelect={() => handleSelectNote(noteId)}
            >
              <BookOpen style={{ color: '#C49A78' }} />
              <span>{ref}</span>
              <span className="ml-auto text-xs opacity-50 truncate max-w-[140px]">{noteTitle}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Tags">
          {uniqueTags.map(({ tag, noteId, noteTitle }) => (
            <CommandItem
              key={`tag-${tag}`}
              value={`tag-${tag}`}
              onSelect={() => handleSelectNote(noteId)}
            >
              <Hash style={{ color: 'var(--silica)' }} />
              <span>{tag}</span>
              <span className="ml-auto text-xs opacity-50 truncate max-w-[140px]">{noteTitle}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
