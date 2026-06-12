// supabase/functions/import-apple-note/handler.ts
import { textToTipTap, countWords, computeExternalId } from '../_shared/apple-notes.ts';

export const MAX_TEXT_BYTES = 100 * 1024;
export const MAX_TITLE_LEN = 512;

export interface ImportBody {
  title?: unknown;
  text?: unknown;
  created_at?: unknown;
  modified_at?: unknown;
  folder_name?: unknown;
}

export interface NoteInsert {
  user_id: string;
  title: string;
  content: string;
  folder_id: string;
  type: 'general';
  tags: string[];
  word_count: number;
  source: 'apple_notes';
  external_id: string;
  apple_modified_at: string;
}

export interface NoteUpdate {
  title: string;
  content: string;
  word_count: number;
  apple_modified_at: string;
}

export interface ImportDeps {
  // Resolves token → user, enforcing revocation + hourly rate limit atomically.
  consumeToken: (tokenHash: string) => Promise<{ userId: string | null; rateLimited: boolean }>;
  findExistingNote: (userId: string, externalId: string) =>
    Promise<{ id: string; appleModifiedAt: string | null } | null>;
  insertNote: (row: NoteInsert) => Promise<string>;
  updateNote: (id: string, fields: NoteUpdate) => Promise<void>;
  findOrCreateFolder: (userId: string, name: string, parentId: string | null) => Promise<string>;
}

export type ImportStatus = 'created' | 'updated' | 'unchanged';
export interface HandlerResponse {
  status: number;
  body: { status: ImportStatus; note_id: string } | { error: string };
}

const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export async function handleImport(
  deps: ImportDeps,
  tokenHash: string,
  body: ImportBody,
): Promise<HandlerResponse> {
  if (!tokenHash) return { status: 401, body: { error: 'unauthorized' } };

  const { userId, rateLimited } = await deps.consumeToken(tokenHash);
  if (rateLimited) return { status: 429, body: { error: 'rate_limited' } };
  if (!userId) return { status: 401, body: { error: 'unauthorized' } };

  const text = asString(body.text) ?? '';
  if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) {
    return { status: 400, body: { error: 'text too large' } };
  }
  let title = (asString(body.title) ?? '').trim() || 'Untitled';
  if (title.length > MAX_TITLE_LEN) title = title.slice(0, MAX_TITLE_LEN);

  const createdAt = asString(body.created_at);
  if (!createdAt) return { status: 400, body: { error: 'created_at required' } };
  const modifiedAt = asString(body.modified_at) ?? createdAt;
  const folderName = asString(body.folder_name);

  const externalId = await computeExternalId(createdAt, title);
  const content = textToTipTap(text);
  const wordCount = countWords(text);

  // Placement: an "Apple Notes" root folder, optionally a named subfolder.
  const rootId = await deps.findOrCreateFolder(userId, 'Apple Notes', null);
  const folderId = folderName
    ? await deps.findOrCreateFolder(userId, folderName, rootId)
    : rootId;

  const existing = await deps.findExistingNote(userId, externalId);
  if (!existing) {
    const id = await deps.insertNote({
      user_id: userId, title, content, folder_id: folderId,
      type: 'general', tags: [], word_count: wordCount,
      source: 'apple_notes', external_id: externalId, apple_modified_at: modifiedAt,
    });
    return { status: 200, body: { status: 'created', note_id: id } };
  }

  // Upsert guard: overwrite only when the Apple note is genuinely newer than
  // what we last imported. Equal/older modified_at → no write (no-op re-run,
  // and a Psalms-side edit is preserved).
  const isNewer = existing.appleModifiedAt === null ||
    new Date(modifiedAt).getTime() > new Date(existing.appleModifiedAt).getTime();
  if (!isNewer) {
    return { status: 200, body: { status: 'unchanged', note_id: existing.id } };
  }
  await deps.updateNote(existing.id, { title, content, word_count: wordCount, apple_modified_at: modifiedAt });
  return { status: 200, body: { status: 'updated', note_id: existing.id } };
}
