// @vitest-environment jsdom
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Editor mock that captures event handlers so tests can drive selectionUpdate,
// and exposes a mutable selection. coordsAtPos is needed for the desktop branch.
const handlers: Record<string, Array<() => void>> = {};
const fakeEditor = {
  state: { selection: { from: 0, to: 0 } },
  view: { coordsAtPos: () => ({ top: 10, bottom: 20, left: 30, right: 40 }) },
  on: (event: string, cb: () => void) => {
    (handlers[event] ||= []).push(cb);
  },
  off: (event: string, cb: () => void) => {
    handlers[event] = (handlers[event] || []).filter((h) => h !== cb);
  },
  chain: () => ({ focus: () => ({ setStyleHighlight: () => ({ run() {} }), unsetStyleHighlight: () => ({ run() {} }), undo: () => ({ run() {} }), redo: () => ({ run() {} }), toggleHeading: () => ({ run() {} }), setParagraph: () => ({ run() {} }) }) }),
  can: () => ({ undo: () => true, redo: () => true }),
  isActive: () => false,
  commands: { focus: () => {} },
};

function fireSelection(from: number, to: number) {
  fakeEditor.state.selection = { from, to };
  // React 19 only flushes state updates triggered inside act(); the editor's
  // selectionUpdate listener is invoked directly here, so wrap it.
  act(() => {
    (handlers.selectionUpdate || []).forEach((h) => h());
  });
}

vi.mock('../context/useNoteCollection', () => ({
  useNoteCollection: () => ({
    notes: [],
    activeNote: { id: 'n1', title: 'T', createdAt: new Date().toISOString(), tags: [] },
    collection: { openNote: vi.fn() },
  }),
}));
vi.mock('../context/useNotepadActions', () => ({ useNotepadActions: () => ({ updateNote: vi.fn() }) }));
vi.mock('../context/useReferenceGraph', () => ({ useReferenceGraph: () => ({ graph: null }) }));
vi.mock('../editor/use-note-editor', () => ({ useNoteEditor: () => ({ editor: fakeEditor }) }));
vi.mock('../editor/use-note-link-popup', () => ({
  useNoteLinkPopup: () => ({ popup: null, search: '', setSearch: vi.fn(), filteredNotes: [], dismiss: vi.fn(), insert: vi.fn() }),
}));
vi.mock('../editor/use-verse-tooltip', () => ({
  useVerseTooltip: () => ({ tooltip: null, onMouseOver: vi.fn(), onMouseOut: vi.fn() }),
}));
vi.mock('@tiptap/react', () => ({ EditorContent: () => <div data-testid="editor-content" /> }));
vi.mock('../../auth/context/useAccountProfile', () => ({ useAccountProfile: () => ({ profile: null }) }));
vi.mock('../decorations/DecorationLayer', () => ({ DecorationLayer: () => null }));
vi.mock('../decorations/useDecorations', () => ({ useDecorations: () => ({ decorations: [], applyDecoration: vi.fn() }) }));
vi.mock('../decorations/DecorationTray', () => ({ DecorationTray: () => null }));
// Render a visible marker so presence of the popover is assertable.
vi.mock('./HighlightSwatchPopover', () => ({ HighlightSwatchPopover: () => <div data-testid="swatch-popover" /> }));

import { NotepadEditor } from './Editor';

afterEach(cleanup);

describe('NotepadEditor mobile highlight button', () => {
  it('does NOT auto-open the popover on a non-empty selection (mobile)', () => {
    const { queryByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireSelection(2, 8);
    expect(queryByTestId('swatch-popover')).toBeNull();
  });

  it('disables the Highlight button with no selection and enables it with one', () => {
    const { container } = render(<NotepadEditor toolbarPlacement="bottom" />);
    const btn = container.querySelector('[title="Highlight"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
    fireSelection(2, 8);
    expect(btn.disabled).toBe(false);
  });

  it('opens the popover when the Highlight button is tapped', () => {
    const { container, queryByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireSelection(2, 8);
    fireEvent.click(container.querySelector('[title="Highlight"]') as HTMLElement);
    expect(queryByTestId('swatch-popover')).not.toBeNull();
  });

  it('closes the popover when the selection collapses', () => {
    const { container, queryByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireSelection(2, 8);
    fireEvent.click(container.querySelector('[title="Highlight"]') as HTMLElement);
    expect(queryByTestId('swatch-popover')).not.toBeNull();
    fireSelection(5, 5);
    expect(queryByTestId('swatch-popover')).toBeNull();
  });

  it('still auto-opens on the desktop toolbar and renders no Highlight button', () => {
    const { container, queryByTestId } = render(<NotepadEditor />);
    expect(container.querySelector('[title="Highlight"]')).toBeNull();
    fireSelection(2, 8);
    expect(queryByTestId('swatch-popover')).not.toBeNull();
  });
});
