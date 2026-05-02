import { useMemo } from 'react';
import { useNotepad } from '../context/useNotepad';
import { VERSE_REGEX } from '../extensions/bible-verse-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TipTapNode {
  text?: string;
  content?: TipTapNode[];
  [key: string]: unknown;
}

function extractText(node: TipTapNode): string {
  if (node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractText).join(' ');
  }
  return '';
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function countVerses(text: string): number {
  const regex = new RegExp(VERSE_REGEX.source, 'g');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InfoPanel() {
  const { notes, folders, activeNote } = useNotepad();

  const stats = useMemo(() => {
    if (!activeNote) return null;

    let plainText = '';
    try {
      const json = JSON.parse(activeNote.content) as TipTapNode;
      plainText = extractText(json);
    } catch {
      plainText = activeNote.content;
    }

    const wordCount = countWords(plainText);
    const verseCount = countVerses(plainText);
    const outgoingLinks = (activeNote.content.match(/"noteLink"/g) ?? []).length;
    const incomingBacklinks = notes.filter(
      (n) => n.id !== activeNote.id && n.content.includes(activeNote.title),
    ).length;

    const folder = folders.find((f) => f.id === activeNote.folderId);
    const folderName = folder?.name ?? '—';

    const typeLabels: Record<string, string> = {
      devotion: 'Devotion Notes',
      sermon: 'Sermon Notes',
      theme: 'Themes',
    };
    const noteType = typeLabels[activeNote.type] ?? activeNote.type;

    return {
      wordCount,
      verseCount,
      outgoingLinks,
      incomingBacklinks,
      folderName,
      noteType,
      created: formatDate(activeNote.createdAt),
      updated: formatDate(activeNote.updatedAt),
      tags: activeNote.tags.length > 0 ? activeNote.tags.join(', ') : '—',
    };
  }, [activeNote, notes, folders]);

  if (!activeNote || !stats) {
    return (
      <div style={styles.empty}>Select a note to see its info.</div>
    );
  }

  const rows: { label: string; value: string | number }[] = [
    { label: 'Type', value: stats.noteType },
    { label: 'Folder', value: stats.folderName },
    { label: 'Words', value: stats.wordCount },
    { label: 'Bible References', value: stats.verseCount },
    { label: 'Outgoing Links', value: stats.outgoingLinks },
    { label: 'Incoming Links', value: stats.incomingBacklinks },
    { label: 'Tags', value: stats.tags },
    { label: 'Created', value: stats.created },
    { label: 'Last Updated', value: stats.updated },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Note Info</h2>
      <table style={styles.table}>
        <tbody>
          {rows.map(({ label, value }) => (
            <tr key={label} style={styles.row}>
              <td style={styles.labelCell}>{label}</td>
              <td style={styles.valueCell}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    padding: '1.5rem 1.25rem',
    overflowY: 'auto' as const,
    height: '100%',
  },
  heading: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.4rem',
    fontWeight: 400,
    color: 'var(--charred)',
    margin: 0,
    marginBottom: '1.25rem',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.875rem',
    color: 'var(--silica)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  row: {
    borderBottom: '1px solid rgba(206, 204, 202, 0.3)',
  },
  labelCell: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.78rem',
    color: 'var(--silica)',
    padding: '0.55rem 0.5rem 0.55rem 0',
    whiteSpace: 'nowrap' as const,
    verticalAlign: 'top' as const,
    width: '40%',
    letterSpacing: '0.02em',
  },
  valueCell: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.875rem',
    color: 'var(--deep-umber)',
    padding: '0.55rem 0 0.55rem 0.5rem',
    verticalAlign: 'top' as const,
  },
};
