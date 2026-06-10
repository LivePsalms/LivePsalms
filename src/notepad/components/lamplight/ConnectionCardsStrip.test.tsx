// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { ConnectionCardsStrip } from './ConnectionCardsStrip';
import { FakeLamplightAdapter } from '../../storage/fake-lamplight-adapter';
import type { Note } from '../../types';

// Stub useAuthSession so tests don't require an AuthProvider in scope.
// The component renders with no user → firstName = null → why text bare.
// vi.hoisted ensures the mock variable is available when vi.mock is hoisted.
const mockUseAuthSession = vi.hoisted(() => vi.fn(() => ({ user: null, loading: false })));
vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: mockUseAuthSession,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  mockUseAuthSession.mockReset();
  mockUseAuthSession.mockImplementation(() => ({ user: null, loading: false }));
});

function makeContent(text: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
}

function fakeNote(over: Partial<Note>): Note {
  return {
    id: 'note-1',
    title: 'Untitled',
    content: makeContent('word '.repeat(150).trim()),
    folderId: 'folder-1',
    type: 'devotion',
    tags: [],
    wordCount: 150,
    createdAt: '2026-05-27T00:00:00.000Z',
    updatedAt: '2026-05-27T00:00:00.000Z',
    ...over,
  };
}

describe('ConnectionCardsStrip', () => {
  it('renders nothing when no active note', () => {
    const adapter = new FakeLamplightAdapter();
    const loadNeighborNotes = async () => [];
    const { container } = render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={null}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when active note is below word threshold', () => {
    const adapter = new FakeLamplightAdapter();
    const shortNote = fakeNote({ content: makeContent('short') });
    const loadNeighborNotes = async () => [];
    const { container } = render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={shortNote}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when embedding is not ready (transient state)', async () => {
    const adapter = new FakeLamplightAdapter();
    // adapter has no seeded embedding for note-1
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async () => [];
    const { container } = render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    // The strip stays hidden during waiting_for_embedding — no placeholder.
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('renders nothing when no neighbors above threshold', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async () => [];
    const { container } = render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('renders header + chips when neighbors exist', async () => {
    localStorage.setItem('lp.notepad.connectionCards.open', 'true');
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
      { relatedNoteId: 'note-3', similarity: 0.88 },
    ]);
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText(/Connection Cards/i)).toBeInTheDocument());
    expect(screen.getByText('Note note-2')).toBeInTheDocument();
    expect(screen.getByText('Note note-3')).toBeInTheDocument();
  });

  it('chip click reveals the why detail; second click on same chip hides it', async () => {
    localStorage.setItem('lp.notepad.connectionCards.open', 'true');
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    adapter.__seedConnectionWhy('note-1', 'note-2', 'Both notes circle the same wilderness motif.');
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText('Note note-2')).toBeInTheDocument());

    const chipButton = screen.getByRole('button', { name: /show why this connects to Note note-2/i });
    fireEvent.click(chipButton);
    await waitFor(() =>
      expect(screen.getByText('Both notes circle the same wilderness motif.')).toBeInTheDocument(),
    );

    fireEvent.click(chipButton);
    await waitFor(() =>
      expect(screen.queryByText('Both notes circle the same wilderness motif.')).not.toBeInTheDocument(),
    );
  });

  it('chip click shows why text prefixed with first name when user is authenticated', async () => {
    localStorage.setItem('lp.notepad.connectionCards.open', 'true');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseAuthSession.mockReturnValue({ user: { user_metadata: { full_name: 'Sarah Mitchell' } }, loading: false } as any);

    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    adapter.__seedConnectionWhy('note-1', 'note-2', 'Both notes circle the same wilderness motif.');
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText('Note note-2')).toBeInTheDocument());

    const chipButton = screen.getByRole('button', { name: /show why this connects to Note note-2/i });
    fireEvent.click(chipButton);
    await waitFor(() =>
      expect(
        screen.getByText('Sarah — Both notes circle the same wilderness motif.'),
      ).toBeInTheDocument(),
    );
  });

  it('open link invokes onOpenNote and does not toggle expand', async () => {
    localStorage.setItem('lp.notepad.connectionCards.open', 'true');
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    const onOpenNote = vi.fn();
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={onOpenNote}
      />,
    );
    await waitFor(() => expect(screen.getByText('Note note-2')).toBeInTheDocument());

    const openButton = screen.getByRole('button', { name: /open note: Note note-2/i });
    fireEvent.click(openButton);
    expect(onOpenNote).toHaveBeenCalledWith('note-2');
    // No detail zone surfaced, because we did not toggle expand:
    expect(screen.queryByText('Lighting…')).not.toBeInTheDocument();
  });

  it('respects the server-supplied similarity threshold (hides neighbors below it)', async () => {
    // The strip pulls the threshold from `app_config` via the adapter. Setting
    // it strictly above all seeded neighbors must cause the strip to fall to
    // its hidden state — proving the threshold actually flows through.
    const adapter = new FakeLamplightAdapter();
    adapter.connectionCardThresholds = { minSimilarity: 0.99 };
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
      { relatedNoteId: 'note-3', similarity: 0.88 },
    ]);
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    const { container } = render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    // Wait long enough for the threshold fetch + hook re-run.
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('renders neighbors when server-supplied threshold is loose enough', async () => {
    localStorage.setItem('lp.notepad.connectionCards.open', 'true');
    const adapter = new FakeLamplightAdapter();
    adapter.connectionCardThresholds = { minSimilarity: 0.3 };
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.4 },
    ]);
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('Note note-2')).toBeInTheDocument(),
    );
  });

  it('surfaces validators_failed error inline in detail zone', async () => {
    localStorage.setItem('lp.notepad.connectionCards.open', 'true');
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    adapter.__failNextGenerateConnectionWhy('validators_failed');
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText('Note note-2')).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole('button', { name: /show why this connects to Note note-2/i }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Couldn't read this connection/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Try again/i)).toBeInTheDocument();
  });
});

describe('ConnectionCardsStrip show/hide toggle', () => {
  function seedReadyStrip() {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    return { adapter, note, loadNeighborNotes };
  }

  it('defaults to closed: header is collapsed and cards are hidden', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyStrip();
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    const header = await screen.findByRole('button', { name: /connection cards/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Note note-2')).not.toBeInTheDocument();
  });

  it('clicking the header opens the list and persists the choice', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyStrip();
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    const header = await screen.findByRole('button', { name: /connection cards/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Note note-2')).not.toBeInTheDocument();

    act(() => {
      fireEvent.click(header);
    });

    expect(await screen.findByText('Note note-2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /connection cards/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(localStorage.getItem('lp.notepad.connectionCards.open')).toBe('true');
  });

  it('renders open on mount when localStorage has the open preference', async () => {
    localStorage.setItem('lp.notepad.connectionCards.open', 'true');
    const { adapter, note, loadNeighborNotes } = seedReadyStrip();
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    const header = await screen.findByRole('button', { name: /connection cards/i });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('Note note-2')).toBeInTheDocument();
  });
});
