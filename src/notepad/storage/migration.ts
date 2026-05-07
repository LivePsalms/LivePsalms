import type { StorageAdapter } from './adapter';

/**
 * AdapterMigration — copies every Folder and Note from `source` to `target`,
 * preserving ids and timestamps. Pure copy — does NOT mutate the source.
 *
 * Folders are imported before Notes so each Note's `folderId` reference
 * resolves at the destination. Note ids are preserved so `noteLink` marks
 * embedded inside content keep resolving after the move.
 */

export type MigrationEvent =
  | { kind: 'loading' }
  | { kind: 'folders'; current: number; total: number }
  | { kind: 'notes'; current: number; total: number };

export interface MigrationResult {
  folders: number;
  notes: number;
}

export interface MigrateAdapterOpts {
  onEvent?: (event: MigrationEvent) => void;
}

export async function migrateAdapter(
  source: StorageAdapter,
  target: StorageAdapter,
  opts: MigrateAdapterOpts = {},
): Promise<MigrationResult> {
  const emit = opts.onEvent ?? (() => {});

  emit({ kind: 'loading' });
  const folders = await source.getFolders();
  const notes = await source.getNotes();

  for (let i = 0; i < folders.length; i++) {
    emit({ kind: 'folders', current: i + 1, total: folders.length });
    await target.importFolder(folders[i]);
  }

  for (let i = 0; i < notes.length; i++) {
    emit({ kind: 'notes', current: i + 1, total: notes.length });
    await target.importNote(notes[i]);
  }

  return { folders: folders.length, notes: notes.length };
}
