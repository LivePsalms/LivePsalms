// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ConnectionCardsStrip } from './ConnectionCardsStrip';
import { FakeLamplightAdapter } from '../../storage/fake-lamplight-adapter';
import type { Note } from '../../types';

// Stub useAuthSession so tests don't require an AuthProvider in scope.
// The component renders with no user → firstName = null → why text bare.
vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: () => ({ user: null, loading: false }),
}));

afterEach(cleanup);

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

  it('open link invokes onOpenNote and does not toggle expand', async () => {
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

  it('surfaces validators_failed error inline in detail zone', async () => {
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
