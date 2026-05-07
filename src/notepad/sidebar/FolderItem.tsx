import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FOLDER_ICONS } from '../components/NewFolderDialog';
import type { Note, Folder, NoteType } from '../types';
import { NoteItem } from './NoteItem';
import { NewNoteDialog } from './NewNoteDialog';
import { useTreeViewState } from './tree-view-state';

export interface FolderItemProps {
  folder: Folder;
  /** Notes whose `folderId` matches this folder, already filtered. */
  notes: Note[];
  /** Direct child folders, already sorted by `order`. */
  childFolders: Folder[];
  /** Lookups passed through for recursive descent. */
  notesByFolder: Map<string, Note[]>;
  childFoldersByParent: Map<string, Folder[]>;
  /** All folders flat — used by `NoteItem`'s MoveToFolderDialog options. */
  allFolders: Folder[];
  activeNoteId: string | null;
  onOpen: (id: string) => void;
  onCreateNote: (folderId: string, type: NoteType) => void;
  onRenameNote: (id: string, title: string) => void;
  onDuplicateNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onMoveNote: (noteId: string, folderId: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onCreateSubfolder: (parentId: string, name: string) => void;
}

export function FolderItem(props: FolderItemProps) {
  const {
    folder,
    notes,
    childFolders,
    notesByFolder,
    childFoldersByParent,
    allFolders,
    activeNoteId,
    onOpen,
    onCreateNote,
    onRenameNote,
    onDuplicateNote,
    onDeleteNote,
    onMoveNote,
    onRenameFolder,
    onDeleteFolder,
    onCreateSubfolder,
  } = props;

  const treeView = useTreeViewState();
  const open = treeView.isExpanded(`folder:${folder.id}`, true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newNoteOpen, setNewNoteOpen] = useState(false);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            {/* Folder header */}
            <button
              onClick={() => treeView.toggle(`folder:${folder.id}`, true)}
              className="flex items-center gap-1.5 w-full px-1 py-1 rounded hover:bg-black/5 transition-colors"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {open ? (
                <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--silica)' }} />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--silica)' }} />
              )}
              {(() => {
                const iconEntry = FOLDER_ICONS.find((i) => i.key === folder.icon);
                if (iconEntry) {
                  const FIcon = iconEntry.icon;
                  return <FIcon className="w-3.5 h-3.5 shrink-0" style={{ color: folder.color || 'var(--silica)' }} />;
                }
                return null;
              })()}
              <span
                className="text-[12px] font-medium truncate text-left flex-1"
                style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
              >
                {folder.name}
              </span>
            </button>

            {/* Children */}
            {open && (
              <div className="ml-3 mt-0.5 space-y-0.5">
                {notes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    isActive={note.id === activeNoteId}
                    folders={allFolders}
                    onOpen={onOpen}
                    onRename={onRenameNote}
                    onDuplicate={onDuplicateNote}
                    onDelete={onDeleteNote}
                    onMove={onMoveNote}
                  />
                ))}

                {/* Child folders (recursion) */}
                {childFolders.map((child) => (
                  <FolderItem
                    key={child.id}
                    folder={child}
                    notes={notesByFolder.get(child.id) ?? []}
                    childFolders={childFoldersByParent.get(child.id) ?? []}
                    notesByFolder={notesByFolder}
                    childFoldersByParent={childFoldersByParent}
                    allFolders={allFolders}
                    activeNoteId={activeNoteId}
                    onOpen={onOpen}
                    onCreateNote={onCreateNote}
                    onRenameNote={onRenameNote}
                    onDuplicateNote={onDuplicateNote}
                    onDeleteNote={onDeleteNote}
                    onMoveNote={onMoveNote}
                    onRenameFolder={onRenameFolder}
                    onDeleteFolder={onDeleteFolder}
                    onCreateSubfolder={onCreateSubfolder}
                  />
                ))}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent style={{ fontFamily: 'Outfit, sans-serif' }}>
          <ContextMenuItem
            onClick={() => {
              const next = prompt('Rename folder:', folder.name);
              if (next && next.trim()) onRenameFolder(folder.id, next.trim());
            }}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => setNewNoteOpen(true)}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            New Note Inside
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              const name = prompt('Subfolder name:');
              if (name && name.trim()) onCreateSubfolder(folder.id, name.trim());
            }}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            New Subfolder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-red-600 focus:text-red-600"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete folder confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent style={{ fontFamily: 'Outfit, sans-serif' }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription style={{ fontFamily: 'Outfit, sans-serif' }}>
              Are you sure you want to delete "{folder.name}"? Notes inside will be moved to root.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ fontFamily: 'Outfit, sans-serif' }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDeleteFolder(folder.id)}
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Note dialog */}
      <NewNoteDialog
        open={newNoteOpen}
        onOpenChange={setNewNoteOpen}
        folderId={folder.id}
        onCreate={onCreateNote}
      />
    </>
  );
}
