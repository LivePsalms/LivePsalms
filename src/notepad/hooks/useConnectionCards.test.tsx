// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useConnectionCards } from './useConnectionCards';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import type { Note } from '../types';

afterEach(cleanup);

function makeContent(text: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text }] },
    ],
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

describe('useConnectionCards', () => {
  it('returns inactive when activeNote is null', async () => {
    const adapter = new FakeLamplightAdapter();
    const loadNeighborNotes = async () => [];
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: null,
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('inactive'));
  });

  it('returns inactive when active note has <100 words', async () => {
    const adapter = new FakeLamplightAdapter();
    const shortNote = fakeNote({ content: makeContent('short note') });
    const loadNeighborNotes = async () => [];
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: shortNote,
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('inactive'));
  });

  it('returns inactive when total note count <10', async () => {
    const adapter = new FakeLamplightAdapter();
    const note = fakeNote({});
    const loadNeighborNotes = async () => [];
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: note,
        totalNoteCount: 5,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('inactive'));
  });

  it('returns waiting_for_embedding when qualifying but no embedding yet', async () => {
    const adapter = new FakeLamplightAdapter();
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async () => [];
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: note,
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() =>
      expect(result.current.state.phase).toBe('waiting_for_embedding'),
    );
  });

  it('returns no_connections when neighbors list is empty', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async () => [];
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: note,
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('no_connections'));
  });

  it('returns ready with up to 3 cards when neighbors exist', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
      { relatedNoteId: 'note-3', similarity: 0.88 },
      { relatedNoteId: 'note-4', similarity: 0.82 },
      { relatedNoteId: 'note-5', similarity: 0.80 },
      { relatedNoteId: 'note-6', similarity: 0.79 },
    ]);
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: note,
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    if (result.current.state.phase !== 'ready') throw new Error('phase');
    expect(result.current.state.cards.length).toBe(3);
    expect(result.current.state.cards[0].relatedNoteId).toBe('note-2');
    expect(result.current.state.cards[0].why.phase).toBe('collapsed');
  });

  it('expandCard transitions to shown on success', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: note,
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));

    await act(async () => {
      await result.current.expandCard('note-2');
    });

    if (result.current.state.phase !== 'ready') throw new Error('phase');
    expect(result.current.state.cards[0].why.phase).toBe('shown');
    if (result.current.state.cards[0].why.phase === 'shown') {
      expect(typeof result.current.state.cards[0].why.text).toBe('string');
    }
  });

  it('expandCard surfaces validators_failed reason', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    adapter.__failNextGenerateConnectionWhy('validators_failed');
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: note,
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));

    await act(async () => {
      await result.current.expandCard('note-2');
    });

    if (result.current.state.phase !== 'ready') throw new Error('phase');
    const card = result.current.state.cards[0];
    expect(card.why.phase).toBe('error');
    if (card.why.phase === 'error') expect(card.why.reason).toBe('validators_failed');
  });
});
