import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react';
import { BibleVerse } from '../extensions/bible-verse';
import { NoteLink } from '../extensions/note-link';
import { TagMark } from '../extensions/tag-mark';
import { fetchVerseText } from '../extensions/bible-verse-utils';
import type { VerseResult } from '../extensions/bible-verse-utils';
import { useNotepad } from '../context/useNotepad';

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
  const { notes, activeNote, updateNote, openNote } = useNotepad();

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '2rem 2.5rem',
        overflowY: 'auto',
        position: 'relative',
      }}
    >
      {/* Title */}
      <input
        type="text"
        value={activeNote.title}
        onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
        placeholder="Untitled"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '2rem',
          fontWeight: 300,
          color: 'var(--charred)',
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
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '0.8rem',
          color: 'var(--silica)',
          marginBottom: '0.75rem',
          letterSpacing: '0.03em',
        }}
      >
        {formatDate(activeNote.createdAt)}
      </div>

      {/* Tags */}
      {activeNote.tags.length > 0 && (
        <div
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
                fontFamily: "'Outfit', sans-serif",
                fontSize: '0.78rem',
                background: 'rgba(188, 179, 163, 0.2)',
                color: 'var(--deep-umber)',
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
        style={{
          border: 'none',
          borderTop: '1px solid var(--pale-stone)',
          marginBottom: '1.5rem',
        }}
      />

      {/* Bubble Menu */}
      {editor && (
        <BubbleMenu
          editor={editor}
          style={{
            display: 'flex',
            gap: '2px',
            background: 'rgba(240, 236, 232, 0.97)',
            border: '1px solid var(--pale-stone)',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          }}
        >
          <BubbleButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold size={14} />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic size={14} />
          </BubbleButton>
          <BubbleDivider />
          <BubbleButton
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            <Heading1 size={14} />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            <Heading2 size={14} />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            <Heading3 size={14} />
          </BubbleButton>
          <BubbleDivider />
          <BubbleButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            <List size={14} />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Ordered List"
          >
            <ListOrdered size={14} />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
          >
            <Quote size={14} />
          </BubbleButton>
        </BubbleMenu>
      )}

      {/* Editor content */}
      <div
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        onClick={handleClick}
        style={{ flex: 1 }}
      >
        <EditorContent editor={editor} className="prose prose-sm max-w-none notepad-editor" />
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

interface BubbleButtonProps {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function BubbleButton({ active, onClick, title, children }: BubbleButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        background: active ? 'var(--warm-sand)' : 'transparent',
        color: active ? 'var(--charred)' : 'var(--deep-umber)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background =
            'rgba(188, 179, 163, 0.3)';
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function BubbleDivider() {
  return (
    <div
      style={{
        width: '1px',
        height: '20px',
        background: 'var(--pale-stone)',
        margin: '4px 2px',
        alignSelf: 'center',
      }}
    />
  );
}
