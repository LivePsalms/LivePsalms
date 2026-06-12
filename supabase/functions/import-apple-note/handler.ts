// supabase/functions/import-apple-note/handler.ts
import { textToTipTap, countWords, computeExternalId } from '../_shared/apple-notes.ts';

export const MAX_TEXT_BYTES = 100 * 1024;
export const MAX_TITLE_LEN = 512;

export interface ImportBody {
  title?: unknown;
  text?: unknown;
  folder_name?: unknown;
  // created_at / modified_at may still be sent by older Shortcuts but are
  // ignored: Apple Shortcuts cannot expose a note's real id or dates, so
  // identity is derived from the note's content instead (see below).
  created_at?: unknown;
  modified_at?: unknown;
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
}

export interface ImportDeps {
  // Resolves token → user, enforcing revocation + hourly rate limit atomically.
  consumeToken: (tokenHash: string) => Promise<{ userId: string | null; rateLimited: boolean }>;
  findExistingNote: (userId: string, externalId: string) => Promise<{ id: string } | null>;
  insertNote: (row: NoteInsert) => Promise<string>;
  findOrCreateFolder: (userId: string, name: string, parentId: string | null) => Promise<string>;
}

export type ImportStatus = 'created' | 'unchanged';
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
  const folderName = asString(body.folder_name);

  // Dedup identity = hash of the note's content (title + body). Apple Shortcuts
  // cannot supply a stable note id or its creation/modification dates, so the
  // content itself is the key: re-importing an unchanged note is a no-op, and a
  // note that was edited in Apple Notes imports as a new note (its hash differs).
  const externalId = await computeExternalId(title, text);
  const content = textToTipTap(text);
  const wordCount = countWords(text);

  // Placement: an "Apple Notes" root folder, optionally a named subfolder.
  const rootId = await deps.findOrCreateFolder(userId, 'Apple Notes', null);
  const folderId = folderName
    ? await deps.findOrCreateFolder(userId, folderName, rootId)
    : rootId;

  const existing = await deps.findExistingNote(userId, externalId);
  if (existing) {
    return { status: 200, body: { status: 'unchanged', note_id: existing.id } };
  }

  const id = await deps.insertNote({
    user_id: userId, title, content, folder_id: folderId,
    type: 'general', tags: [], word_count: wordCount,
    source: 'apple_notes', external_id: externalId,
  });
  return { status: 200, body: { status: 'created', note_id: id } };
}
