import { describe, it, expect, vi } from 'vitest';
import { handleImport, type ImportDeps } from './handler.ts';

function deps(over: Partial<ImportDeps> = {}): ImportDeps {
  return {
    consumeToken: async () => ({ userId: 'u-1', rateLimited: false }),
    findExistingNote: async () => null,
    insertNote: async () => 'note-new',
    findOrCreateFolder: async () => 'folder-1',
    ...over,
  };
}

describe('handleImport auth', () => {
  it('401 when token hash empty', async () => {
    const res = await handleImport(deps(), '', { title: 't' });
    expect(res.status).toBe(401);
  });
  it('401 when token unknown/revoked', async () => {
    const res = await handleImport(
      deps({ consumeToken: async () => ({ userId: null, rateLimited: false }) }), 'h', {});
    expect(res.status).toBe(401);
  });
  it('429 when rate limited', async () => {
    const res = await handleImport(
      deps({ consumeToken: async () => ({ userId: null, rateLimited: true }) }), 'h', {});
    expect(res.status).toBe(429);
  });
});

describe('handleImport validation', () => {
  it('400 when text exceeds the size cap', async () => {
    const big = 'x'.repeat(100 * 1024 + 1);
    const res = await handleImport(deps(), 'h', { text: big });
    expect(res.status).toBe(400);
  });
  it('does not require created_at (Apple Shortcuts cannot supply dates)', async () => {
    const res = await handleImport(deps(), 'h', { title: 'Psalm 23', text: 'shepherd' });
    expect(res.status).toBe(200);
  });
});

describe('handleImport upsert (content-hash dedup)', () => {
  it('creates a new note with apple_notes provenance', async () => {
    const insertNote = vi.fn(async () => 'note-new');
    const res = await handleImport(
      deps({ insertNote }), 'h',
      { title: 'Psalm 23', text: 'shepherd' });
    expect(res).toEqual({ status: 200, body: { status: 'created', note_id: 'note-new' } });
    const row = insertNote.mock.calls[0][0];
    expect(row.source).toBe('apple_notes');
    expect(row.type).toBe('general');
    expect(row.word_count).toBe(1);
    expect(row.folder_id).toBe('folder-1');
    expect(typeof row.external_id).toBe('string');
    expect(row.external_id).toHaveLength(64); // SHA-256 hex
  });

  it('keys external_id on title + body, so an edited note hashes differently', async () => {
    const a = vi.fn(async () => 'a');
    await handleImport(deps({ insertNote: a }), 'h', { title: 'Psalm 23', text: 'original' });
    const b = vi.fn(async () => 'b');
    await handleImport(deps({ insertNote: b }), 'h', { title: 'Psalm 23', text: 'edited' });
    expect(a.mock.calls[0][0].external_id).not.toBe(b.mock.calls[0][0].external_id);
  });

  it('is unchanged (no insert) when the same content already exists', async () => {
    const insertNote = vi.fn(async () => 'note-new');
    const res = await handleImport(
      deps({ findExistingNote: async () => ({ id: 'old' }), insertNote }),
      'h', { title: 'Psalm 23', text: 'shepherd' });
    expect(res.body).toEqual({ status: 'unchanged', note_id: 'old' });
    expect(insertNote).not.toHaveBeenCalled();
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
      { title: 'n', text: 'b', folder_name: 'Sermons' });
    expect(calls).toEqual([['u-1', 'Apple Notes', null], ['u-1', 'Sermons', 'root-folder']]);
    expect(insertNote.mock.calls[0][0].folder_id).toBe('sub-folder');
  });
});
