import { describe, it, expect, vi } from 'vitest';
import { handleImport, type ImportDeps } from './handler.ts';

function deps(over: Partial<ImportDeps> = {}): ImportDeps {
  return {
    consumeToken: async () => ({ userId: 'u-1', rateLimited: false }),
    findExistingNote: async () => null,
    insertNote: async () => 'note-new',
    updateNote: async () => {},
    findOrCreateFolder: async () => 'folder-1',
    ...over,
  };
}

describe('handleImport auth', () => {
  it('401 when token hash empty', async () => {
    const res = await handleImport(deps(), '', { created_at: 'x', title: 't' });
    expect(res.status).toBe(401);
  });
  it('401 when token unknown/revoked', async () => {
    const res = await handleImport(
      deps({ consumeToken: async () => ({ userId: null, rateLimited: false }) }), 'h', { created_at: 'x' });
    expect(res.status).toBe(401);
  });
  it('429 when rate limited', async () => {
    const res = await handleImport(
      deps({ consumeToken: async () => ({ userId: null, rateLimited: true }) }), 'h', { created_at: 'x' });
    expect(res.status).toBe(429);
  });
});

describe('handleImport validation', () => {
  it('400 when created_at missing', async () => {
    const res = await handleImport(deps(), 'h', { title: 't', text: 'a' });
    expect(res.status).toBe(400);
  });
  it('400 when text exceeds the size cap', async () => {
    const big = 'x'.repeat(100 * 1024 + 1);
    const res = await handleImport(deps(), 'h', { created_at: 'x', text: big });
    expect(res.status).toBe(400);
  });
});

describe('handleImport upsert', () => {
  it('creates a new note with apple_notes provenance', async () => {
    const insertNote = vi.fn(async () => 'note-new');
    const res = await handleImport(
      deps({ insertNote }), 'h',
      { created_at: '2026-05-01T00:00:00Z', title: 'Psalm 23', text: 'shepherd' });
    expect(res).toEqual({ status: 200, body: { status: 'created', note_id: 'note-new' } });
    const row = insertNote.mock.calls[0][0];
    expect(row.source).toBe('apple_notes');
    expect(row.type).toBe('general');
    expect(row.word_count).toBe(1);
    expect(row.folder_id).toBe('folder-1');
  });

  it('is unchanged when modified_at is not newer', async () => {
    const updateNote = vi.fn(async () => {});
    const res = await handleImport(
      deps({ findExistingNote: async () => ({ id: 'old', appleModifiedAt: '2026-06-10T00:00:00Z' }), updateNote }),
      'h', { created_at: '2026-05-01T00:00:00Z', title: 'Psalm 23', text: 'x', modified_at: '2026-06-10T00:00:00Z' });
    expect(res.body).toEqual({ status: 'unchanged', note_id: 'old' });
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('updates when the Apple note is newer', async () => {
    const updateNote = vi.fn(async () => {});
    const res = await handleImport(
      deps({ findExistingNote: async () => ({ id: 'old', appleModifiedAt: '2026-06-10T00:00:00Z' }), updateNote }),
      'h', { created_at: '2026-05-01T00:00:00Z', title: 'Psalm 23', text: 'new body', modified_at: '2026-06-11T00:00:00Z' });
    expect(res.body).toEqual({ status: 'updated', note_id: 'old' });
    expect(updateNote).toHaveBeenCalledOnce();
  });

  it('nests under a named subfolder when folder_name is provided', async () => {
    const calls: Array<[string, string, string | null]> = [];
    const findOrCreateFolder = vi.fn(async (u: string, name: string, parent: string | null) => {
      calls.push([u, name, parent]);
      return name === 'Apple Notes' ? 'root-folder' : 'sub-folder';
    });
    const insertNote = vi.fn(async () => 'note-new');
    await handleImport(
      deps({ findOrCreateFolder, insertNote }), 'h',
      { created_at: '2026-05-01T00:00:00Z', title: 'n', text: 'b', folder_name: 'Sermons' });
    expect(calls).toEqual([['u-1', 'Apple Notes', null], ['u-1', 'Sermons', 'root-folder']]);
    expect(insertNote.mock.calls[0][0].folder_id).toBe('sub-folder');
  });
});
