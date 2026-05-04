import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LocalStorageAdapter } from '../storage/local-storage';
import type { StorageAdapter } from '../storage/adapter';

interface MigrationDialogProps {
  open: boolean;
  onClose: () => void;
  targetAdapter: StorageAdapter;
  onMigrationComplete: () => void;
}

export function MigrationDialog({
  open,
  onClose,
  targetAdapter,
  onMigrationComplete,
}: MigrationDialogProps) {
  const [migrating, setMigrating] = useState(false);
  const localAdapter = new LocalStorageAdapter();

  const localNotesRaw = localStorage.getItem('notepad_notes');
  const localNotes = localNotesRaw ? JSON.parse(localNotesRaw) : [];
  const noteCount = localNotes.length;

  const handleImport = async () => {
    setMigrating(true);
    try {
      // Get all local data
      const notes = await localAdapter.getNotes();
      const folders = await localAdapter.getFolders();

      // Create folders first (so note folder references resolve)
      const folderIdMap = new Map<string, string>();
      for (const folder of folders) {
        const created = await targetAdapter.createFolder({
          name: folder.name,
          parentId: folder.parentId,
          order: folder.order,
          icon: folder.icon,
          color: folder.color,
        });
        folderIdMap.set(folder.id, created.id);
      }

      // Create notes with remapped folder IDs
      for (const note of notes) {
        const mappedFolderId = folderIdMap.get(note.folderId) ?? 'root';
        await targetAdapter.createNote({
          title: note.title,
          content: note.content,
          folderId: mappedFolderId,
          type: note.type,
          tags: note.tags,
          wordCount: note.wordCount ?? 0,
        });
      }

      // Clear localStorage
      localStorage.removeItem('notepad_notes');
      localStorage.removeItem('notepad_folders');

      onMigrationComplete();
      onClose();
    } catch (err) {
      console.error('Migration failed:', err);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-sm p-8"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
        }}
      >
        <DialogTitle
          className="text-lg font-medium text-center"
          style={{
            color: 'var(--deep-umber)',
            fontFamily: 'Cormorant Garamond, serif',
          }}
        >
          Import Local Notes?
        </DialogTitle>
        <DialogDescription
          className="text-center text-sm mt-2"
          style={{
            color: 'var(--silica)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          You have {noteCount} {noteCount === 1 ? 'note' : 'notes'} saved locally.
          Would you like to import them to your account?
        </DialogDescription>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={migrating}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              border: '1px solid var(--pale-stone)',
              color: 'var(--deep-umber)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            No Thanks
          </button>
          <button
            onClick={handleImport}
            disabled={migrating}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity"
            style={{
              background: 'var(--deep-umber)',
              color: 'var(--plaster)',
              fontFamily: 'Outfit, sans-serif',
              opacity: migrating ? 0.6 : 1,
            }}
          >
            {migrating ? 'Importing...' : 'Import Notes'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
