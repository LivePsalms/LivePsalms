import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import {
  Undo2,
  Redo2,
  Heading,
  List,
  ListOrdered,
  Quote,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Underline as UnderlineIcon,
  ChevronDown,
  Palette,
  Check,
} from 'lucide-react';
import { BibleVerse } from '../extensions/bible-verse';
import { NoteLink } from '../extensions/note-link';
import { TagMark } from '../extensions/tag-mark';
import { fetchVerseText } from '../extensions/bible-verse-utils';
import type { VerseResult } from '../extensions/bible-verse-utils';
import { useNoteCollection } from '../context/useNoteCollection';
import { useJournalTheme } from '../hooks/use-journal-theme';
import { JOURNAL_THEMES } from '../types';
import type { JournalTheme } from '../types';
import '../journal-themes.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerseTooltip {
  x: number;
  y: number;
  verse: VerseResult;
}

interface NoteLinkPopup {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTags(text: string): string[] {
  const matches = text.match(/#\w+/g);
  return matches ? [...new Set(matches)] : [];
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

export function NotepadEditor() {
  const { notes, activeNote, collection } = useNoteCollection();
  const updateNote = collection.updateNote;
  const openNote = collection.openNote;
  const [journalTheme, setJournalTheme] = useJournalTheme();

  // Tooltip state for bible verse hover
  const [verseTooltip, setVerseTooltip] = useState<VerseTooltip | null>(null);

  // Note-link [[ popup state
  const [noteLinkPopup, setNoteLinkPopup] = useState<NoteLinkPopup | null>(null);
  const [noteLinkSearch, setNoteLinkSearch] = useState('');

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // TipTap editor
  // -------------------------------------------------------------------------

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      Underline,
      BibleVerse,
      NoteLink,
      TagMark,
    ],
    content: '',
    onUpdate({ editor: ed }) {
      if (!activeNote) return;
      const text = ed.getText();
      const tags = extractTags(text);
      const json = JSON.stringify(ed.getJSON());

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateNote(activeNote.id, { content: json, tags });
      }, 500);
    },
  });

  // -------------------------------------------------------------------------
  // Load note content when active note changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!editor) return;

    if (!activeNote) {
      editor.commands.setContent('');
      return;
    }

    if (activeNote.content) {
      try {
        const json = JSON.parse(activeNote.content);
        editor.commands.setContent(json, false);
      } catch {
        editor.commands.setContent('');
      }
    } else {
      editor.commands.setContent('');
    }

    // Move cursor to start without emitting update
    editor.commands.focus('start');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.id, editor]);

  // -------------------------------------------------------------------------
  // [[ trigger — show note link popup
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!editor) return;

    const dom = editor.view.dom as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '[') return;

      // Check if the character immediately before the cursor is also '['
      const { state } = editor;
      const { from } = state.selection;
      if (from < 2) return;

      const prevChar = state.doc.textBetween(from - 1, from);
      if (prevChar !== '[') return;

      // Prevent the second '[' from being inserted
      e.preventDefault();

      // Delete the first '[' that was already inserted
      editor.chain().deleteRange({ from: from - 1, to: from }).run();

      // Get approximate cursor position from the DOM selection
      const sel = window.getSelection();
      let x = 200;
      let y = 200;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        x = rect.left;
        y = rect.bottom + 8;
      }

      setNoteLinkSearch('');
      setNoteLinkPopup({ x, y });
    };

    dom.addEventListener('keydown', handleKeyDown);
    return () => dom.removeEventListener('keydown', handleKeyDown);
  }, [editor]);

  // -------------------------------------------------------------------------
  // Verse hover tooltip
  // -------------------------------------------------------------------------

  const handleMouseOver = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const verseEl = target.closest('[data-bible-verse]') as HTMLElement | null;

      if (!verseEl) {
        setVerseTooltip(null);
        return;
      }

      const reference = verseEl.getAttribute('data-reference');
      if (!reference) return;

      const rect = verseEl.getBoundingClientRect();
      const result = await fetchVerseText(reference);
      if (result) {
        setVerseTooltip({ x: rect.left, y: rect.bottom + 8, verse: result });
      }
    },
    [],
  );

  const handleMouseOut = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.relatedTarget as HTMLElement | null;
    if (!target?.closest?.('[data-bible-verse]')) {
      setVerseTooltip(null);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Note link click
  // -------------------------------------------------------------------------

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const linkEl = target.closest('[data-note-link]') as HTMLElement | null;
      if (!linkEl) return;
      const noteId = linkEl.getAttribute('data-note-id');
      if (noteId) openNote(noteId);
    },
    [openNote],
  );

  // -------------------------------------------------------------------------
  // Insert note link from popup
  // -------------------------------------------------------------------------

  const insertNoteLink = useCallback(
    (noteId: string, noteTitle: string) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: noteTitle,
          marks: [{ type: 'noteLink', attrs: { noteId, noteTitle } }],
        })
        .run();
      setNoteLinkPopup(null);
      setNoteLinkSearch('');
    },
    [editor],
  );

  // Filtered notes for the popup
  const filteredNotes = notes.filter(
    (n) =>
      n.id !== activeNote?.id &&
      n.title.toLowerCase().includes(noteLinkSearch.toLowerCase()),
  );

  // Heading dropdown
  const [headingOpen, setHeadingOpen] = useState(false);

  // Theme picker dropdown
  const [themeOpen, setThemeOpen] = useState(false);

  const isJournalThemed = journalTheme !== 'default';

  const currentHeading = editor
    ? editor.isActive('heading', { level: 1 }) ? 'H1'
    : editor.isActive('heading', { level: 2 }) ? 'H2'
    : editor.isActive('heading', { level: 3 }) ? 'H3'
    : 'H'
    : 'H';

  // -------------------------------------------------------------------------
  // No active note — placeholder
  // -------------------------------------------------------------------------

  if (!activeNote) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--silica)',
          fontFamily: "'Outfit', sans-serif",
          fontSize: '0.95rem',
        }}
      >
        Select a note or create a new one
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Fixed formatting toolbar */}
      {editor && (
        <div
          className="shrink-0 flex items-center gap-0.5 px-3 border-b"
          style={{
            height: 40,
            background: 'rgba(240, 236, 232, 0.97)',
            borderColor: 'var(--pale-stone)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          {/* Undo / Redo */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo2 size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo2 size={15} />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Heading dropdown */}
          <div className="relative">
            <ToolbarButton
              onClick={() => { setHeadingOpen(!headingOpen); setThemeOpen(false); }}
              active={currentHeading !== 'H'}
              title="Heading"
            >
              <Heading size={15} />
              <span className="text-[9px] ml-0.5">{currentHeading !== 'H' ? currentHeading : ''}</span>
              <ChevronDown size={10} className="ml-0.5 opacity-50" />
            </ToolbarButton>
            {headingOpen && (
              <div
                className="absolute top-full left-0 mt-1 rounded-md shadow-lg z-50 py-1"
                style={{ background: 'rgba(240, 236, 232, 0.97)', border: '1px solid var(--pale-stone)', minWidth: 100 }}
              >
                {([1, 2, 3] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => { editor.chain().focus().toggleHeading({ level }).run(); setHeadingOpen(false); }}
                    className="flex items-center w-full px-3 py-1.5 text-[12px] hover:bg-black/5 transition-colors"
                    style={{
                      color: editor.isActive('heading', { level }) ? 'var(--charred)' : 'var(--deep-umber)',
                      fontWeight: editor.isActive('heading', { level }) ? 600 : 400,
                      fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    Heading {level}
                  </button>
                ))}
                <button
                  onClick={() => { editor.chain().focus().setParagraph().run(); setHeadingOpen(false); }}
                  className="flex items-center w-full px-3 py-1.5 text-[12px] hover:bg-black/5 transition-colors"
                  style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                >
                  Paragraph
                </button>
              </div>
            )}
          </div>

          {/* List buttons */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Ordered List"
          >
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="Blockquote"
          >
            <Quote size={15} />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Inline formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="Inline Code"
          >
            <Code size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline"
          >
            <UnderlineIcon size={15} />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Theme picker */}
          <div className="relative">
            <ToolbarButton
              onClick={() => { setThemeOpen(!themeOpen); setHeadingOpen(false); }}
              active={isJournalThemed}
              title="Journal Theme"
            >
              <Palette size={15} />
              <ChevronDown size={10} className="ml-0.5 opacity-50" />
            </ToolbarButton>
            {themeOpen && (
              <div
                className="absolute top-full right-0 mt-1 rounded-md shadow-lg z-50 py-1"
                style={{
                  background: 'rgba(240, 236, 232, 0.97)',
                  border: '1px solid var(--pale-stone)',
                  minWidth: 200,
                }}
              >
                {JOURNAL_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setJournalTheme(t.id as JournalTheme);
                      setThemeOpen(false);
                    }}
                    className="flex items-center w-full px-3 py-1.5 text-[12px] hover:bg-black/5 transition-colors gap-2"
                    style={{
                      color: journalTheme === t.id ? 'var(--charred)' : 'var(--deep-umber)',
                      fontWeight: journalTheme === t.id ? 600 : 400,
                      fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: t.swatch,
                        border: t.id === 'default' ? '1px solid var(--pale-stone)' : 'none',
                        flexShrink: 0,
                      }}
                    />
                    <span className="flex-1 text-left">{t.label}</span>
                    {journalTheme === t.id && (
                      <Check size={12} style={{ color: 'var(--charred)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scrollable content area */}
      <div
        data-journal-theme={journalTheme}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isJournalThemed ? '32px' : '2rem 2.5rem',
          position: 'relative',
          background: isJournalThemed ? '#f5f0e8' : undefined,
        }}
      >
        <div className={isJournalThemed ? 'journal-page' : ''}>
          {/* Title */}
          <input
            type="text"
            value={activeNote.title}
            onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
            placeholder="Untitled"
            className={isJournalThemed ? 'journal-title' : ''}
            style={{
              fontFamily: isJournalThemed ? undefined : "'Cormorant Garamond', serif",
              fontSize: isJournalThemed ? undefined : '2rem',
              fontWeight: isJournalThemed ? undefined : 300,
              color: isJournalThemed ? undefined : 'var(--charred)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              marginBottom: '0.35rem',
              padding: 0,
            }}
          />

          {/* Date */}
          <div
            className={isJournalThemed ? 'journal-date' : ''}
            style={{
              fontFamily: isJournalThemed ? undefined : "'Outfit', sans-serif",
              fontSize: isJournalThemed ? undefined : '0.8rem',
              color: isJournalThemed ? undefined : 'var(--silica)',
              marginBottom: '0.75rem',
              letterSpacing: '0.03em',
            }}
          >
            {formatDate(activeNote.createdAt)}
          </div>

          {/* Tags */}
          {activeNote.tags.length > 0 && (
            <div
              className={isJournalThemed ? 'journal-tags' : ''}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem',
                marginBottom: '0.75rem',
              }}
            >
              {activeNote.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontFamily: isJournalThemed ? undefined : "'Outfit', sans-serif",
                    fontSize: isJournalThemed ? undefined : '0.78rem',
                    background: isJournalThemed ? undefined : 'rgba(188, 179, 163, 0.2)',
                    color: isJournalThemed ? undefined : 'var(--deep-umber)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Divider */}
          <hr
            className={isJournalThemed ? 'journal-divider' : ''}
            style={isJournalThemed ? {} : {
              border: 'none',
              borderTop: '1px solid var(--pale-stone)',
              marginBottom: '1.5rem',
            }}
          />

          {/* Editor content */}
          <div
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
            onClick={handleClick}
            style={{ flex: 1 }}
          >
            <EditorContent editor={editor} className="prose prose-sm max-w-none notepad-editor" />
          </div>
        </div>
      </div>

      {/* Verse tooltip */}
      {verseTooltip && (
        <div
          style={{
            position: 'fixed',
            left: verseTooltip.x,
            top: verseTooltip.y,
            zIndex: 9999,
            maxWidth: '340px',
            background: 'rgba(240, 236, 232, 0.97)',
            border: '1px solid var(--pale-stone)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--charred)',
              marginBottom: '0.4rem',
              letterSpacing: '0.02em',
            }}
          >
            {verseTooltip.verse.reference}
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--deep-umber)',
              lineHeight: 1.6,
              fontStyle: 'italic',
              marginBottom: '0.4rem',
            }}
          >
            &ldquo;{verseTooltip.verse.text}&rdquo;
          </div>
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--silica)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {verseTooltip.verse.translation}
          </div>
        </div>
      )}

      {/* Note link popup */}
      {noteLinkPopup && (
        <div
          style={{
            position: 'fixed',
            left: noteLinkPopup.x,
            top: noteLinkPopup.y,
            zIndex: 9999,
            width: '260px',
            background: 'rgba(240, 236, 232, 0.97)',
            border: '1px solid var(--pale-stone)',
            borderRadius: '10px',
            padding: '0.5rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          <input
            autoFocus
            type="text"
            value={noteLinkSearch}
            onChange={(e) => setNoteLinkSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredNotes.length > 0) {
                insertNoteLink(filteredNotes[0].id, filteredNotes[0].title);
              }
              if (e.key === 'Escape') {
                setNoteLinkPopup(null);
                setNoteLinkSearch('');
              }
            }}
            placeholder="Search notes..."
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              fontSize: '0.85rem',
              border: '1px solid var(--pale-stone)',
              borderRadius: '6px',
              background: 'transparent',
              outline: 'none',
              color: 'var(--deep-umber)',
              marginBottom: '0.4rem',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {filteredNotes.length === 0 ? (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--silica)',
                  padding: '0.4rem 0.6rem',
                }}
              >
                No notes found
              </div>
            ) : (
              filteredNotes.slice(0, 10).map((note) => (
                <button
                  key={note.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertNoteLink(note.id, note.title);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.85rem',
                    color: 'var(--deep-umber)',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(188, 179, 163, 0.25)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background =
                      'transparent')
                  }
                >
                  {note.title}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

interface ToolbarButtonProps {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ active, disabled, onClick, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center rounded transition-colors"
      style={{
        width: 30,
        height: 28,
        cursor: disabled ? 'default' : 'pointer',
        background: active ? 'rgba(188, 179, 163, 0.35)' : 'transparent',
        color: disabled ? 'var(--pale-stone)' : active ? 'var(--charred)' : 'var(--deep-umber)',
        border: 'none',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled)
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(188, 179, 163, 0.2)';
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled)
          (e.currentTarget as HTMLButtonElement).style.background = active ? 'rgba(188, 179, 163, 0.35)' : 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: 'var(--pale-stone)',
        margin: '0 4px',
        alignSelf: 'center',
      }}
    />
  );
}
