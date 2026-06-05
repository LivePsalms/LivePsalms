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
import { buildSearchIndex } from './search-index';

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

  const { verses: uniqueVerses, tags: uniqueTags } = useMemo(
    () => buildSearchIndex(notes),
    [notes],
  );

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
