// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { ConnectionCardsPanel } from './ConnectionCardsPanel';
import { FakeLamplightAdapter } from '../../storage/fake-lamplight-adapter';
import type { Note } from '../../types';

const mockUseAuthSession = vi.hoisted(() => vi.fn(() => ({ user: null, loading: false })));
vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: mockUseAuthSession,
}));

afterEach(() => {
  cleanup();
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

function seedReadyPanel() {
  const adapter = new FakeLamplightAdapter();
  adapter.__seedNoteEmbedding('note-1');
  adapter.__seedConnectionNeighbors('note-1', [
    { relatedNoteId: 'note-2', similarity: 0.95 },
  ]);
  adapter.__seedConnectionWhy('note-1', 'note-2', 'Both notes circle the same wilderness motif.');
  const note = fakeNote({ id: 'note-1' });
  const loadNeighborNotes = async (ids: string[]) =>
    ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
  return { adapter, note, loadNeighborNotes };
}

describe('ConnectionCardsPanel layout="stack"', () => {
  it('lays cards out vertically (no horizontal scroll container)', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="stack"
      />,
    );
    const list = await screen.findByRole('list');
    expect(list.className).toContain('flex-col');
    expect(list.className).not.toContain('overflow-x-auto');
  });

  it('expands the "why" inline inside the tapped card (not a top panel)', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="stack"
      />,
    );
    await waitFor(() => expect(screen.getByText('Note note-2')).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole('button', { name: /show why this connects to Note note-2/i }),
    );
    await waitFor(() =>
      expect(screen.getByText('Both notes circle the same wilderness motif.')).toBeInTheDocument(),
    );

    const [item] = screen.getAllByRole('listitem');
    expect(
      within(item).getByText('Both notes circle the same wilderness motif.'),
    ).toBeInTheDocument();
  });

  it('shows a "Why these connect" hint in the footer at rest', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="stack"
      />,
    );
    expect(
      await screen.findByRole('button', { name: /why these connect/i }),
    ).toBeInTheDocument();
  });

  it('tapping the hint reveals the why and switches its label to "Hide"', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="stack"
      />,
    );
    const hint = await screen.findByRole('button', { name: /why these connect/i });
    fireEvent.click(hint);

    await waitFor(() =>
      expect(screen.getByText('Both notes circle the same wilderness motif.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^hide$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /why these connect/i })).not.toBeInTheDocument();
  });

  it('tapping the hint a second time collapses the why', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="stack"
      />,
    );
    const hint = await screen.findByRole('button', { name: /why these connect/i });
    fireEvent.click(hint);
    await waitFor(() =>
      expect(screen.getByText('Both notes circle the same wilderness motif.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /^hide$/i }));
    await waitFor(() =>
      expect(
        screen.queryByText('Both notes circle the same wilderness motif.'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /why these connect/i })).toBeInTheDocument();
  });

  it('does not render the hint in strip layout', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="strip"
      />,
    );
    await screen.findByText('Note note-2');
    expect(screen.queryByRole('button', { name: /why these connect/i })).not.toBeInTheDocument();
  });
});
