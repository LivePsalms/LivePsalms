import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { createPortal } from 'react-dom';
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
  Sparkles,
} from 'lucide-react';
import { HighlightSwatchPopover } from './HighlightSwatchPopover';
import { HighlightPill } from './HighlightPill';
import { useDecorations } from '../decorations/useDecorations';
import { DecorationLayer, type DecorationLayerHandle } from '../decorations/DecorationLayer';
import { TEXT_Z } from '../decorations/decoration-geometry';
import { DecorationTray } from '../decorations/DecorationTray';
import { STYLE_ASSETS } from '../styles/manifest';
import { useNoteCollection } from '../context/useNoteCollection';
import { useNotepadActions } from '../context/useNotepadActions';
import { useReferenceGraph } from '../context/useReferenceGraph';
import { useNoteEditor } from '../editor/use-note-editor';
import { useNoteLinkPopup } from '../editor/use-note-link-popup';
import { useVerseTooltip } from '../editor/use-verse-tooltip';
import { formatTag } from '../utils/tags';
import { useAccountProfile } from '../../auth/context/useAccountProfile';
import { emptyStateMessage } from '../utils/empty-state-message';
import type { Note } from '../types';

export interface NotepadEditorProps {
  onAfterSave?: (note: Note) => void;
  /** 'top' (default, desktop) renders the toolbar above the content. 'bottom'
   *  pins it to the bottom of the editor (mobile accessory bar). */
  toolbarPlacement?: 'top' | 'bottom';
  /** When toolbarPlacement is 'bottom', px to lift the bar above the keyboard. */
  toolbarBottomOffset?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

export function NotepadEditor({
  onAfterSave,
  toolbarPlacement = 'top',
  toolbarBottomOffset = 0,
}: NotepadEditorProps = {}) {
  const { notes, activeNote, collection } = useNoteCollection();
  const actions = useNotepadActions();
  const { graph } = useReferenceGraph();
  const updateNote = actions.updateNote;
  const openNote = collection.openNote;
  const { profile } = useAccountProfile();

  // The TipTap↔NotepadActions bridge for the active Note. See NoteEditor in CONTEXT.md.
  const { editor } = useNoteEditor({ activeNote, updateNote, onAfterSave });

  const isBottomToolbar = toolbarPlacement === 'bottom';

  // Read-only decoration overlay state (style stickers placed over the note).
  const decorationsApi = useDecorations(activeNote, updateNote);
  const [selectedDecoration, setSelectedDecoration] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const decorationLayerRef = useRef<DecorationLayerHandle>(null);
  const lastInteractionRef = useRef<'pointer' | 'keyboard'>('pointer');
  useEffect(() => {
    const onPointer = () => { lastInteractionRef.current = 'pointer'; };
    const onKey = () => { lastInteractionRef.current = 'keyboard'; };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  // A behind-text decoration sits below the editor text, so a normal click lands
  // on the text (keeping it editable). Alt-click or double-click over the
  // decoration selects it instead — it then pops above the text and is movable.
  const selectBehindDecoration = (e: React.MouseEvent): boolean => {
    const id = decorationLayerRef.current?.hitTestBehind(e.clientX, e.clientY);
    if (!id) return false;
    e.preventDefault();
    setSelectedDecoration(id);
    return true;
  };

  const [swatchAnchor, setSwatchAnchor] = useState<{ top: number; left: number } | null>(null);
  const [swatchQuery, setSwatchQuery] = useState('');
  const [swatchDismissed, setSwatchDismissed] = useState(false);
  const [swatchAutoFocus, setSwatchAutoFocus] = useState(false);
  const dismissedRangeRef = useRef<{ from: number; to: number } | null>(null);
  // Mobile-only highlight pill, shown just above the selection once it settles.
  const [pillAnchor, setPillAnchor] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const pillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillRangeRef = useRef<{ from: number; to: number } | null>(null);
  const PILL_SETTLE_MS = 250;
  const PILL_TOP_MARGIN = 56; // if the selection sits this close to the top, flip the pill below it

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { from, to } = editor.state.selection;
      if (isBottomToolbar) {
        // Mobile: never show the pill mid-drag. Hide while the range is moving,
        // then reveal ~250ms after it settles. Recompute the anchor on fire.
        if (from === to) {
          if (pillTimerRef.current) { clearTimeout(pillTimerRef.current); pillTimerRef.current = null; }
          pillRangeRef.current = null;
          setPillAnchor(null);
          return;
        }
        const prev = pillRangeRef.current;
        if (prev && prev.from === from && prev.to === to) return; // unchanged → no-op, avoid flicker
        pillRangeRef.current = { from, to };
        setPillAnchor(null);
        if (pillTimerRef.current) clearTimeout(pillTimerRef.current);
        pillTimerRef.current = setTimeout(() => {
          const coords = editor.view.coordsAtPos(from);
          const left = Math.max(8, Math.min(coords.left, window.innerWidth - 8));
          const anchor = coords.top < PILL_TOP_MARGIN
            ? { top: coords.bottom + 6, left }                       // near top → below
            : { bottom: window.innerHeight - coords.top + 6, left }; // default → above
          setPillAnchor(anchor);
        }, PILL_SETTLE_MS);
        return;
      }
      // Desktop: unchanged auto-open behavior.
      if (from === to) {
        setSwatchAnchor(null);
        setSwatchDismissed(false);
        dismissedRangeRef.current = null;
        return;
      }
      const start = editor.view.coordsAtPos(from);
      setSwatchAnchor({ top: start.bottom + 6, left: start.left });
      setSwatchAutoFocus(lastInteractionRef.current === 'pointer');
      const dismissed = dismissedRangeRef.current;
      if (!dismissed || dismissed.from !== from || dismissed.to !== to) {
        setSwatchDismissed(false);
        dismissedRangeRef.current = null;
      }
    };
    editor.on('selectionUpdate', update);
    return () => {
      editor.off('selectionUpdate', update);
      if (pillTimerRef.current) { clearTimeout(pillTimerRef.current); pillTimerRef.current = null; }
    };
  }, [editor, isBottomToolbar]);

  // `[[` popup controller — owns trigger detection, anchor, search, insertion.
  const {
    popup: noteLinkPopup,
    search: noteLinkSearch,
    setSearch: setNoteLinkSearch,
    filteredNotes,
    dismiss: dismissNoteLinkPopup,
    insert: insertNoteLink,
  } = useNoteLinkPopup({ editor, notes, activeNoteId: activeNote?.id ?? null });

  // Verse-hover tooltip — cache-read from ReferenceGraph, network fallback, race-fenced.
  const {
    tooltip: verseTooltip,
    onMouseOver: handleMouseOver,
    onMouseOut: handleMouseOut,
  } = useVerseTooltip({ graph });

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

  // Heading dropdown
  const [headingOpen, setHeadingOpen] = useState(false);
  const headingBtnRef = useRef<HTMLDivElement>(null);
  const [headingCoords, setHeadingCoords] = useState<{ bottom: number; left: number }>({ bottom: 0, left: 0 });

  const openHeadingMenu = () => {
    if (!headingOpen && headingBtnRef.current) {
      const r = headingBtnRef.current.getBoundingClientRect();
      // Anchor the menu's bottom 4px above the trigger (it opens upward on mobile).
      setHeadingCoords({ bottom: window.innerHeight - r.top + 4, left: r.left });
    }
    setHeadingOpen((v) => !v);
  };

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
        {emptyStateMessage(profile?.fullName)}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div style={{
      display: 'flex',
      flexDirection: isBottomToolbar ? 'column-reverse' : 'column',
      height: '100%',
      position: 'relative',
      ...(isBottomToolbar ? { width: '100%', minWidth: 0, maxWidth: '100%' } : {}),
    }}>
      {/* Fixed formatting toolbar */}
      {editor && (
        <div
          data-toolbar-placement={toolbarPlacement}
          className={`shrink-0 flex items-center gap-0.5 px-3${isBottomToolbar ? ' scrollbar-hide' : ''}`}
          style={{
            height: 40,
            background: 'rgba(240, 236, 232, 0.97)',
            borderColor: 'var(--pale-stone)',
            borderBottom: isBottomToolbar ? 'none' : '1px solid var(--pale-stone)',
            borderTop: isBottomToolbar ? '1px solid var(--pale-stone)' : 'none',
            fontFamily: 'Outfit, sans-serif',
            position: isBottomToolbar ? 'sticky' : undefined,
            bottom: isBottomToolbar ? `${toolbarBottomOffset}px` : undefined,
            zIndex: isBottomToolbar ? 20 : undefined,
            minWidth: isBottomToolbar ? 0 : undefined,
            overflowX: isBottomToolbar ? 'auto' : undefined,
            // Setting only overflow-x forces computed overflow-y to 'auto' too, which lets
            // the toolbar scroll vertically and clip the icons. Pin it to horizontal-only.
            overflowY: isBottomToolbar ? 'hidden' : undefined,
          }}
        >
          {/* Undo / Redo */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
            mobile={isBottomToolbar}
          >
            <Undo2 size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
            mobile={isBottomToolbar}
          >
            <Redo2 size={15} />
          </ToolbarButton>

          <ToolbarDivider mobile={isBottomToolbar} />

          {/* Heading dropdown */}
          <div className="relative" ref={headingBtnRef}>
            <ToolbarButton
              onClick={openHeadingMenu}
              active={currentHeading !== 'H'}
              title="Heading"
              mobile={isBottomToolbar}
            >
              <Heading size={15} />
              <span className="text-[9px] ml-0.5">{currentHeading !== 'H' ? currentHeading : ''}</span>
              <ChevronDown size={10} className="ml-0.5 opacity-50" />
            </ToolbarButton>
            {headingOpen && (() => {
              const menuItems = (
                <>
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
                </>
              );

              if (isBottomToolbar) {
                return createPortal(
                  <div
                    data-testid="heading-menu"
                    className="rounded-md shadow-lg py-1"
                    style={{
                      position: 'fixed',
                      bottom: headingCoords.bottom,
                      left: headingCoords.left,
                      background: 'rgba(240, 236, 232, 0.97)',
                      border: '1px solid var(--pale-stone)',
                      minWidth: 100,
                      zIndex: 60,
                    }}
                  >
                    {menuItems}
                  </div>,
                  document.body,
                );
              }

              return (
                <div
                  data-testid="heading-menu"
                  className="absolute top-full mt-1 left-0 rounded-md shadow-lg z-50 py-1"
                  style={{ background: 'rgba(240, 236, 232, 0.97)', border: '1px solid var(--pale-stone)', minWidth: 100 }}
                >
                  {menuItems}
                </div>
              );
            })()}
          </div>

          {/* List buttons */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
            mobile={isBottomToolbar}
          >
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Ordered List"
            mobile={isBottomToolbar}
          >
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="Blockquote"
            mobile={isBottomToolbar}
          >
            <Quote size={15} />
          </ToolbarButton>

          <ToolbarDivider mobile={isBottomToolbar} />

          {/* Inline formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
            mobile={isBottomToolbar}
          >
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
            mobile={isBottomToolbar}
          >
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough"
            mobile={isBottomToolbar}
          >
            <Strikethrough size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="Inline Code"
            mobile={isBottomToolbar}
          >
            <Code size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline"
            mobile={isBottomToolbar}
          >
            <UnderlineIcon size={15} />
          </ToolbarButton>
          <ToolbarButton onClick={() => setTrayOpen((v) => !v)} active={trayOpen} title="Decorate" mobile={isBottomToolbar}>
            <Sparkles size={15} />
          </ToolbarButton>
        </div>
      )}

      {/* Scrollable content area */}
      <div
        data-testid="editor-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: isBottomToolbar ? 'hidden' : undefined,
          padding: isBottomToolbar ? '2rem 1.25rem' : '2rem 2.5rem',
          position: 'relative',
        }}
      >
        {/* isolate: contains the text + decoration zIndex contest in one
            stacking context so decorations can render behind OR in front of text. */}
        <div style={{ isolation: 'isolate' }}>
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
                  {formatTag(tag)}
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

          {/* Editor content */}
          <div
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
            onClick={(e) => {
              // Alt-click over a behind-text decoration selects it (it lives below
              // the text, so the click reaches here) without disturbing the text.
              if (e.altKey && selectBehindDecoration(e)) return;
              handleClick(e);
              // The decoration overlay is pointerEvents:none over empty space, so
              // clicks on the editor fall through to here — deselect any decoration.
              // Clicks on a decoration hit its pointerEvents:auto island instead and
              // never reach this handler, so this only fires for genuine editor clicks.
              setSelectedDecoration(null);
              // On mobile (bottom toolbar) there is no hover; a tap shows/dismisses
              // the verse tooltip. handleMouseOver reads e.target.closest(...) so a
              // click event drives it correctly and clears it when tapping off a verse.
              if (isBottomToolbar) handleMouseOver(e);
            }}
            // Double-click over a behind-text decoration selects it too (instead of
            // selecting a word), so it is reachable without holding a modifier key.
            onDoubleClick={selectBehindDecoration}
            // Text sits at TEXT_Z; decorations compute zIndex relative to this so
            // 'send to back' drops them below the text and 'bring to front' lifts
            // them above it (see decorationZIndex).
            style={{ flex: 1, position: 'relative', zIndex: TEXT_Z }}
          >
            <EditorContent editor={editor} className="prose prose-sm max-w-none notepad-editor" />
          </div>

          {/* Interactive decoration overlay — absolutely positioned within the
              relative scroll container so it overlays content and scrolls with it. */}
          <DecorationLayer
            // Keyed by note id so the frozen reference width re-snapshots to the
            // current container size each time a different note is opened.
            key={activeNote.id}
            ref={decorationLayerRef}
            decorations={decorationsApi.decorations}
            selectedId={selectedDecoration}
            onSelect={setSelectedDecoration}
            onDeselect={() => { setSelectedDecoration(null); editor?.commands.focus(); }}
            onChange={(next) => decorationsApi.update(next.id, next)}
            onDelete={(id) => { decorationsApi.remove(id); setSelectedDecoration(null); editor?.commands.focus(); }}
            onDuplicate={(id) => decorationsApi.duplicate(id)}
            onBringToFront={(id) => decorationsApi.bringToFront(id)}
            onSendToBack={(id) => decorationsApi.sendToBack(id)}
          />
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
                dismissNoteLinkPopup();
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

      {/* Highlight swatch popover */}
      {editor && swatchAnchor && !swatchDismissed && (
        <HighlightSwatchPopover
          assets={STYLE_ASSETS}
          query={swatchQuery}
          onQueryChange={setSwatchQuery}
          anchor={swatchAnchor}
          onPick={(id) => editor.chain().focus().setStyleHighlight(id).run()}
          onRemove={() => editor.chain().focus().unsetStyleHighlight().run()}
          onClose={() => {
            setSwatchDismissed(true);
            const { from, to } = editor.state.selection;
            dismissedRangeRef.current = { from, to };
          }}
          autoFocus={swatchAutoFocus}
          onRequestEditorFocus={() => editor.commands.focus()}
        />
      )}

      {editor && isBottomToolbar && pillAnchor && (
        <HighlightPill
          assets={STYLE_ASSETS}
          anchor={pillAnchor}
          onPick={(id) => {
            editor.chain().focus().setStyleHighlight(id).run();
            setPillAnchor(null);
          }}
          onRemove={() => {
            editor.chain().focus().unsetStyleHighlight().run();
            setPillAnchor(null);
          }}
          onClose={() => setPillAnchor(null)}
        />
      )}

      {trayOpen && (
        <DecorationTray
          assets={STYLE_ASSETS}
          onClose={() => setTrayOpen(false)}
          onPlace={(assetId) =>
            decorationsApi.add({ assetId, xPct: 0.4, yPx: 80, widthPct: 0.25, rotation: 0 })
          }
        />
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
  mobile?: boolean;
}

function ToolbarButton({ active, disabled, onClick, title, children, mobile }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center rounded transition-colors"
      style={{
        width: 30,
        height: 28,
        flexShrink: mobile ? 0 : undefined,
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

function ToolbarDivider({ mobile }: { mobile?: boolean }) {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        flexShrink: mobile ? 0 : undefined,
        background: 'var(--pale-stone)',
        margin: '0 4px',
        alignSelf: 'center',
      }}
    />
  );
}
