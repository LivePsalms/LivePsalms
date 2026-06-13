import { useMemo } from 'react';
import { useNoteCollection } from '../context/useNoteCollection';
import { useFolderHierarchy } from '../context/useFolderHierarchy';
import { useReferenceGraph } from '../context/useReferenceGraph';
import { buildNoteStats } from '../graph/note-stats';
import { extractTextFromNote } from '../utils/tiptap-text';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
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
  const { activeNote } = useNoteCollection();
  const { folders } = useFolderHierarchy();
  const { references } = useReferenceGraph();

  const stats = useMemo(() => {
    if (!activeNote) return null;

    const plainText = extractTextFromNote(activeNote);
    const wordCount = countWords(plainText);

    const { backlinkCount, outgoingLinkCount, verseCount } = buildNoteStats(
      activeNote.id,
      references,
    );

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
      outgoingLinkCount,
      backlinkCount,
      folderName,
      noteType,
      created: formatDate(activeNote.createdAt),
      updated: formatDate(activeNote.updatedAt),
    };
  }, [activeNote, references, folders]);

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
    { label: 'Outgoing Links', value: stats.outgoingLinkCount },
    { label: 'Incoming Links', value: stats.backlinkCount },
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
