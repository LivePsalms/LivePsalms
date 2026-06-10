import { useMemo } from 'react';
import { useNoteCollection } from '../context/useNoteCollection';
import { useReferenceGraph } from '../context/useReferenceGraph';
import { NOTE_TYPE_CONFIG } from '../note-type-config';
import type { NoteType } from '../types';
import { buildBacklinks } from './backlinks';

// ---------------------------------------------------------------------------
// Section copy — local because the prose ("DEVOTION NOTES" / "THEMES") is
// specific to this panel. Icon and color come from the shared NOTE_TYPE_CONFIG.
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<NoteType, string> = {
  general: 'GENERAL NOTES',
  devotion: 'DEVOTION NOTES',
  sermon: 'SERMON NOTES',
  theme: 'THEMES',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BacklinksPanel() {
  const { notes, activeNote, collection } = useNoteCollection();
  const { references } = useReferenceGraph();
  const openNote = collection.openNote;

  const groupedBacklinks = useMemo(
    () => (activeNote ? buildBacklinks(activeNote.id, notes, references) : {}),
    [notes, activeNote, references],
  );

  const totalCount = Object.values(groupedBacklinks).reduce(
    (sum, arr) => sum + (arr?.length ?? 0),
    0,
  );

  if (!activeNote) {
    return (
      <div style={styles.empty}>Select a note to see its backlinks.</div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Backlinks</h2>

      {totalCount === 0 ? (
        <p style={styles.emptyText}>No other notes link to this one yet.</p>
      ) : (
        (Object.entries(SECTION_LABELS) as [NoteType, string][]).map(([type, label]) => {
          const cards = groupedBacklinks[type];
          if (!cards || cards.length === 0) return null;

          const cfg = NOTE_TYPE_CONFIG[type];
          const Icon = cfg.icon;

          return (
            <section key={type} style={styles.section}>
              {/* Section header */}
              <div style={styles.sectionHeader}>
                <Icon size={12} color={cfg.color} />
                <span style={{ ...styles.sectionLabel, color: cfg.color }}>
                  {label}
                </span>
              </div>

              {/* Cards */}
              {cards.map(({ note, snippet }) => (
                <button
                  key={note.id}
                  onClick={() => openNote(note.id)}
                  style={styles.card}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(206, 204, 202, 0.15)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
                  }
                >
                  <div style={styles.cardTitle}>{note.title}</div>
                  {snippet && <div style={styles.cardSnippet}>{snippet}</div>}
                </button>
              ))}
            </section>
          );
        })
      )}
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
  emptyText: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.875rem',
    color: 'var(--silica)',
    margin: 0,
  },
  section: {
    marginBottom: '1.25rem',
  },
  sectionHeader: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '0.4rem',
    marginBottom: '0.5rem',
  },
  sectionLabel: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
  },
  card: {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '0.6rem 0.75rem',
    marginBottom: '0.4rem',
    background: 'transparent',
    border: '1px solid rgba(206, 204, 202, 0.5)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  cardTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--deep-umber)',
    marginBottom: '0.25rem',
  },
  cardSnippet: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.78rem',
    color: 'var(--silica)',
    lineHeight: 1.5,
    overflow: 'hidden' as const,
    display: '-webkit-box' as const,
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
  },
};
