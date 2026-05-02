import { useMemo } from 'react';
import { PenLine, Mic, Sparkles, type LucideIcon } from 'lucide-react';
import { useNotepad } from '../context/useNotepad';
import type { NoteType, Note } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TypeConfig {
  icon: LucideIcon;
  color: string;
  label: string;
}

interface BacklinkCard {
  note: Note;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const typeConfig: Record<NoteType, TypeConfig> = {
  devotion: { icon: PenLine, color: '#34D399', label: 'DEVOTION NOTES' },
  sermon:   { icon: Mic,      color: '#38BDF8', label: 'SERMON NOTES' },
  theme:    { icon: Sparkles, color: '#A78BFA', label: 'THEMES' },
};

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
    return node.content.map(extractText).join('');
  }
  return '';
}

function buildSnippet(text: string, title: string): string {
  const idx = text.indexOf(title);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + title.length + 40);
  const before = (start > 0 ? '…' : '') + text.slice(start, idx);
  const after = text.slice(idx + title.length, end) + (end < text.length ? '…' : '');
  return `${before}[${title}]${after}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BacklinksPanel() {
  const { notes, activeNote, openNote } = useNotepad();

  const groupedBacklinks = useMemo<Partial<Record<NoteType, BacklinkCard[]>>>(() => {
    if (!activeNote) return {};

    const result: Partial<Record<NoteType, BacklinkCard[]>> = {};

    for (const note of notes) {
      if (note.id === activeNote.id) continue;
      if (!note.content) continue;

      let plainText = '';
      try {
        const json = JSON.parse(note.content) as TipTapNode;
        plainText = extractText(json);
      } catch {
        plainText = note.content;
      }

      if (!plainText.includes(activeNote.title)) continue;

      const snippet = buildSnippet(plainText, activeNote.title);
      const type = note.type;

      if (!result[type]) result[type] = [];
      result[type]!.push({ note, snippet });
    }

    return result;
  }, [notes, activeNote]);

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
        (Object.entries(typeConfig) as [NoteType, TypeConfig][]).map(([type, cfg]) => {
          const cards = groupedBacklinks[type];
          if (!cards || cards.length === 0) return null;

          const Icon = cfg.icon;

          return (
            <section key={type} style={styles.section}>
              {/* Section header */}
              <div style={styles.sectionHeader}>
                <Icon size={12} color={cfg.color} />
                <span style={{ ...styles.sectionLabel, color: cfg.color }}>
                  {cfg.label}
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
