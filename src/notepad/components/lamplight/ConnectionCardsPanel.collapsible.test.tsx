// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
  const note = fakeNote({ id: 'note-1' });
  const loadNeighborNotes = async (ids: string[]) =>
    ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
  return { adapter, note, loadNeighborNotes };
}

describe('ConnectionCardsPanel collapsible', () => {
  it('collapsible + open renders a header button with the list', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        collapsible
        open
        onToggleOpen={() => {}}
      />,
    );
    const header = await screen.findByRole('button', { name: /connection cards/i });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('Note note-2')).toBeInTheDocument();
  });

  it('collapsible + open=false hides the list but keeps the header', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        collapsible
        open={false}
        onToggleOpen={() => {}}
      />,
    );
    const header = await screen.findByRole('button', { name: /connection cards/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Note note-2')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('non-collapsible keeps a plain (non-button) label and always shows the list', async () => {
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
    expect(await screen.findByText('Note note-2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^connection cards$/i })).not.toBeInTheDocument();
  });
});
