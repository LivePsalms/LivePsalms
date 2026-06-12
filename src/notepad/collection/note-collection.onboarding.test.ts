// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NoteCollection } from './note-collection';
import { FakeStorageAdapter, resetFakeAdapterIds } from './fake-storage-adapter';
import { setOnboardingSink } from '../onboarding/onboarding-events';

afterEach(() => setOnboardingSink(null));

describe('NoteCollection emits note-created', () => {
  it('fires the onboarding event after a successful create', async () => {
    const sink = vi.fn();
    setOnboardingSink(sink);
    resetFakeAdapterIds();
    const adapter = new FakeStorageAdapter();
    const collection = new NoteCollection(adapter);
    await collection.init();
    await collection.createNote('root', 'devotion');
    expect(sink).toHaveBeenCalledWith('note-created');
  });
});

describe('FolderHierarchy emits folder-created', () => {
  it('fires the onboarding event after a successful create', async () => {
    const { FolderHierarchy } = await import('./folder-hierarchy');
    const sink = vi.fn();
    setOnboardingSink(sink);
    resetFakeAdapterIds();
    const adapter = new FakeStorageAdapter();
    const hierarchy = new FolderHierarchy(adapter);
    await hierarchy.init();
    await hierarchy.createFolder('New Folder', null);
    expect(sink).toHaveBeenCalledWith('folder-created');
  });
});
