import { describe, it, expect, beforeEach } from 'vitest';
import { migrateAdapter } from './migration';
import type { MigrationEvent } from './migration';
import { FakeStorageAdapter, resetFakeAdapterIds } from '../collection/fake-storage-adapter';
import type { Note, Folder } from '../types';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n',
    title: 'Note',
    content: '',
    folderId: 'root',
    type: 'devotion',
    tags: [],
    wordCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'f',
    name: 'Folder',
    parentId: null,
    order: 0,
    ...overrides,
  };
}

describe('migrateAdapter', () => {
  let source: FakeStorageAdapter;
  let target: FakeStorageAdapter;

  beforeEach(() => {
    resetFakeAdapterIds();
    source = new FakeStorageAdapter();
    target = new FakeStorageAdapter();
  });

  it('returns zero counts for an empty source', async () => {
    const result = await migrateAdapter(source, target);
    expect(result).toEqual({ folders: 0, notes: 0 });
    expect(target.notes).toEqual([]);
    expect(target.folders).toEqual([]);
  });

  it('copies every Folder and Note to the target', async () => {
    source.folders.push(makeFolder({ id: 'f1', name: 'Alpha' }));
    source.folders.push(makeFolder({ id: 'f2', name: 'Beta' }));
    source.notes.push(makeNote({ id: 'n1', folderId: 'f1' }));
    source.notes.push(makeNote({ id: 'n2', folderId: 'f2' }));

    const result = await migrateAdapter(source, target);

    expect(result).toEqual({ folders: 2, notes: 2 });
    expect(target.folders.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
    expect(target.notes.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
  });

  it('preserves Note ids so embedded noteLink marks keep resolving', async () => {
    const original = makeNote({
      id: 'preserved-id',
      title: 'Original title',
      content: '{"type":"doc"}',
    });
    source.notes.push(original);

    await migrateAdapter(source, target);

    expect(target.notes).toHaveLength(1);
    expect(target.notes[0]).toMatchObject({
      id: 'preserved-id',
      title: 'Original title',
      content: '{"type":"doc"}',
    });
  });

  it('preserves Folder ids so each Note\'s folderId reference stays valid', async () => {
    source.folders.push(makeFolder({ id: 'preserved-folder', name: 'Keep' }));
    source.notes.push(makeNote({ id: 'n1', folderId: 'preserved-folder' }));

    await migrateAdapter(source, target);

    expect(target.folders[0].id).toBe('preserved-folder');
    expect(target.notes[0].folderId).toBe('preserved-folder');
  });

  it('does NOT mutate the source (pure copy)', async () => {
    source.folders.push(makeFolder({ id: 'f1' }));
    source.notes.push(makeNote({ id: 'n1' }));

    await migrateAdapter(source, target);

    expect(source.folders).toHaveLength(1);
    expect(source.notes).toHaveLength(1);
  });

  it('imports all folders before any notes (so folderId references resolve at write time)', async () => {
    source.folders.push(makeFolder({ id: 'f1' }));
    source.folders.push(makeFolder({ id: 'f2' }));
    source.notes.push(makeNote({ id: 'n1' }));
    source.notes.push(makeNote({ id: 'n2' }));

    const order: string[] = [];
    const trackingTarget = new FakeStorageAdapter();
    const origImportFolder = trackingTarget.importFolder.bind(trackingTarget);
    const origImportNote = trackingTarget.importNote.bind(trackingTarget);
    trackingTarget.importFolder = async (f) => {
      order.push(`folder:${f.id}`);
      return origImportFolder(f);
    };
    trackingTarget.importNote = async (n) => {
      order.push(`note:${n.id}`);
      return origImportNote(n);
    };

    await migrateAdapter(source, trackingTarget);

    expect(order).toEqual(['folder:f1', 'folder:f2', 'note:n1', 'note:n2']);
  });

  it('emits MigrationEvents in order with correct counts', async () => {
    source.folders.push(makeFolder({ id: 'f1' }));
    source.folders.push(makeFolder({ id: 'f2' }));
    source.notes.push(makeNote({ id: 'n1' }));

    const events: MigrationEvent[] = [];
    await migrateAdapter(source, target, { onEvent: (e) => events.push(e) });

    expect(events).toEqual([
      { kind: 'loading' },
      { kind: 'folders', current: 1, total: 2 },
      { kind: 'folders', current: 2, total: 2 },
      { kind: 'notes', current: 1, total: 1 },
    ]);
  });

  it('emits a single loading event then nothing else for an empty source', async () => {
    const events: MigrationEvent[] = [];
    await migrateAdapter(source, target, { onEvent: (e) => events.push(e) });
    expect(events).toEqual([{ kind: 'loading' }]);
  });

  it('replaces existing target items when ids collide (uses importNote/importFolder semantics)', async () => {
    target.folders.push(makeFolder({ id: 'f1', name: 'Stale at target' }));
    target.notes.push(makeNote({ id: 'n1', title: 'Stale at target' }));
    source.folders.push(makeFolder({ id: 'f1', name: 'Fresh from source' }));
    source.notes.push(makeNote({ id: 'n1', title: 'Fresh from source' }));

    await migrateAdapter(source, target);

    expect(target.folders).toHaveLength(1);
    expect(target.folders[0].name).toBe('Fresh from source');
    expect(target.notes).toHaveLength(1);
    expect(target.notes[0].title).toBe('Fresh from source');
  });

  it('works without an onEvent callback', async () => {
    source.notes.push(makeNote({ id: 'n1' }));
    await expect(migrateAdapter(source, target)).resolves.toEqual({ folders: 0, notes: 1 });
  });
});
