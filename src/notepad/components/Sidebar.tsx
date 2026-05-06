import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  PenLine,
  Mic,
  Sparkles,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useNoteCollection } from '../context/useNoteCollection';
import { useFolderHierarchy } from '../context/useFolderHierarchy';
import { useNotepadActions } from '../context/useNotepadActions';
import { NewFolderDialog, FOLDER_ICONS } from './NewFolderDialog';
import type { Note, Folder, NoteType } from '../types';

// ---------------------------------------------------------------------------
// Type config
// ---------------------------------------------------------------------------

const NOTE_TYPE_CONFIG: Record<NoteType, { icon: typeof PenLine; color: string; label: string }> = {
  devotion: { icon: PenLine, color: '#6B8B7A', label: 'Devotion' },
  sermon: { icon: Mic, color: '#7A9BAE', label: 'Sermon' },
  theme: { icon: Sparkles, color: '#D4A0A0', label: 'Theme' },
};

// ---------------------------------------------------------------------------
// InlineEdit
// ---------------------------------------------------------------------------

interface InlineEditProps {
  value: string;
  onSave: (next: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

function InlineEdit({ value, onSave, className, style }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      inputRef.current?.select();
    }
  }, [editing, value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  }, [draft, value, onSave]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...style,
          background: 'rgba(188, 179, 163, 0.15)',
          border: '1px solid var(--pale-stone)',
          borderRadius: 3,
          padding: '1px 4px',
          outline: 'none',
          width: '100%',
        }}
        className={className}
      />
    );
  }

  return (
    <span
      className={className}
      style={style}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// MoveToFolderDialog
// ---------------------------------------------------------------------------

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  folders: Folder[];
  onMove: (noteId: string, folderId: string) => void;
}

function MoveToFolderDialog({ open, onOpenChange, noteId, folders, onMove }: MoveToFolderDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ fontFamily: 'Outfit, sans-serif' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
            Move to Folder
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
            <SelectTrigger style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--deep-umber)' }}>
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Root</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 rounded text-[12px]"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onMove(noteId, selectedFolderId);
              onOpenChange(false);
            }}
            className="px-3 py-1.5 rounded text-[12px] font-medium"
            style={{ background: 'var(--deep-umber)', color: 'var(--plaster)', fontFamily: 'Outfit, sans-serif' }}
          >
            Move
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// NewNoteDialog
// ---------------------------------------------------------------------------

interface NewNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  onCreate: (folderId: string, type: NoteType) => void;
}

function NewNoteDialog({ open, onOpenChange, folderId, onCreate }: NewNoteDialogProps) {
  const [noteType, setNoteType] = useState<NoteType>('devotion');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ fontFamily: 'Outfit, sans-serif' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
            New Note
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <label className="text-[11px] mb-1 block" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            Note Type
          </label>
          <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
            <SelectTrigger style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--deep-umber)' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="devotion">Devotion</SelectItem>
              <SelectItem value="sermon">Sermon</SelectItem>
              <SelectItem value="theme">Theme</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 rounded text-[12px]"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onCreate(folderId, noteType);
              onOpenChange(false);
            }}
            className="px-3 py-1.5 rounded text-[12px] font-medium"
            style={{ background: 'var(--deep-umber)', color: 'var(--plaster)', fontFamily: 'Outfit, sans-serif' }}
          >
            Create
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// NoteItem
// ---------------------------------------------------------------------------

interface NoteItemProps {
  note: Note;
  isActive: boolean;
  folders: Folder[];
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (noteId: string, folderId: string) => void;
}

function NoteItem({
  note,
  isActive,
  folders,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
}: NoteItemProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const config = NOTE_TYPE_CONFIG[note.type];
  const Icon = config.icon;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex items-center gap-1.5 px-1 py-1.5 rounded cursor-pointer transition-colors group"
            style={{
              background: isActive ? 'rgba(188, 179, 163, 0.3)' : 'transparent',
              fontFamily: 'Outfit, sans-serif',
            }}
            onClick={() => onOpen(note.id)}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            {/* Options icon — click to open dropdown */}
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <span
                  className="shrink-0 cursor-pointer rounded hover:bg-black/10 transition-all"
                  style={{
                    opacity: hovering || menuOpen ? 1 : 0,
                    transition: 'opacity 0.15s',
                    color: 'var(--silica)',
                    padding: '1px',
                  }}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
                >
                  <MoreVertical className="w-3 h-3" />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent style={{ fontFamily: 'Outfit, sans-serif' }}>
                <DropdownMenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    const next = prompt('Rename note:', note.title);
                    if (next && next.trim()) onRename(note.id, next.trim());
                  }}
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setMenuOpen(false); setMoveOpen(true); }}
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  Move to Folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setMenuOpen(false); onDuplicate(note.id); }}
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                  className="text-red-600 focus:text-red-600"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Icon className="w-3 h-3 shrink-0" style={{ color: config.color }} />

            <InlineEdit
              value={note.title}
              onSave={(title) => onRename(note.id, title)}
              className="text-[11px] truncate flex-1 min-w-0"
              style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent style={{ fontFamily: 'Outfit, sans-serif' }}>
          <ContextMenuItem
            onClick={() => {
              const next = prompt('Rename note:', note.title);
              if (next && next.trim()) onRename(note.id, next.trim());
            }}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => setMoveOpen(true)}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Move to Folder
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onDuplicate(note.id)}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Duplicate
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

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent style={{ fontFamily: 'Outfit, sans-serif' }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Delete Note</AlertDialogTitle>
            <AlertDialogDescription style={{ fontFamily: 'Outfit, sans-serif' }}>
              Are you sure you want to delete "{note.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ fontFamily: 'Outfit, sans-serif' }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(note.id)}
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move dialog */}
      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        noteId={note.id}
        folders={folders}
        onMove={onMove}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// FolderItem
// ---------------------------------------------------------------------------

interface FolderItemProps {
  folder: Folder;
  notes: Note[];
  allFolders: Folder[];
  activeNoteId: string | null;
  filterText: string;
  tagFilter: string | null;
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

function FolderItem({
  folder,
  notes,
  allFolders,
  activeNoteId,
  filterText,
  tagFilter,
  onOpen,
  onCreateNote,
  onRenameNote,
  onDuplicateNote,
  onDeleteNote,
  onMoveNote,
  onRenameFolder,
  onDeleteFolder,
  onCreateSubfolder,
}: FolderItemProps) {
  const [open, setOpen] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newNoteOpen, setNewNoteOpen] = useState(false);

  // Filter notes for this folder
  const filteredNotes = notes.filter((n) => {
    if (n.folderId !== folder.id) return false;
    if (filterText && !n.title.toLowerCase().includes(filterText.toLowerCase())) return false;
    if (tagFilter && !n.tags.includes(tagFilter)) return false;
    return true;
  });

  // Child folders
  const childFolders = allFolders.filter((f) => f.parentId === folder.id);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            {/* Folder header */}
            <button
              onClick={() => setOpen((prev) => !prev)}
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
                {filteredNotes.map((note) => (
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
                    notes={notes}
                    allFolders={allFolders}
                    activeNoteId={activeNoteId}
                    filterText={filterText}
                    tagFilter={tagFilter}
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

// ---------------------------------------------------------------------------
// NotepadSidebar (main export)
// ---------------------------------------------------------------------------

export function NotepadSidebar({ hideCollectionHeader = false }: { hideCollectionHeader?: boolean } = {}) {
  const { notes, activeNoteId, collection } = useNoteCollection();
  const { folders, hierarchy } = useFolderHierarchy();
  const actions = useNotepadActions();

  const openNote = collection.openNote;
  const createNote = collection.createNote.bind(collection);
  const moveNote = collection.moveNote.bind(collection);
  const renameNote = collection.renameNote.bind(collection);
  const deleteNote = collection.deleteNote.bind(collection);
  const duplicateNote = collection.duplicateNote.bind(collection);
  const createFolder = hierarchy.createFolder.bind(hierarchy);
  const renameFolder = hierarchy.renameFolder.bind(hierarchy);
  const deleteFolder = actions.deleteFolder.bind(actions);

  const [filterText, setFilterText] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  // Compute all tags sorted by count descending
  const allTags = (() => {
    const map = new Map<string, number>();
    for (const note of notes) {
      for (const tag of note.tags) {
        map.set(tag, (map.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  })();

  // Root folders (parentId === null)
  const rootFolders = folders.filter((f) => f.parentId === null).sort((a, b) => a.order - b.order);

  // Root notes: folderId === 'root' or folderId doesn't match any folder id
  const folderIds = new Set(folders.map((f) => f.id));
  const rootNotes = notes.filter((n) => {
    const isRoot = n.folderId === 'root' || !folderIds.has(n.folderId);
    if (!isRoot) return false;
    if (filterText && !n.title.toLowerCase().includes(filterText.toLowerCase())) return false;
    if (tagFilter && !n.tags.includes(tagFilter)) return false;
    return true;
  });

  // Group root notes by type
  const notesByType = new Map<NoteType, typeof rootNotes>();
  for (const note of rootNotes) {
    const group = notesByType.get(note.type) ?? [];
    group.push(note);
    notesByType.set(note.type, group);
  }
  const typeOrder: NoteType[] = ['devotion', 'sermon', 'theme'];
  const [typeGroupsExpanded, setTypeGroupsExpanded] = useState<Record<string, boolean>>({
    devotion: true, sermon: true, theme: true,
  });

  const [showNewFolder, setShowNewFolder] = useState(false);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ fontFamily: 'Outfit, sans-serif' }}
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-0">
        {/* Collection Header */}
        {!hideCollectionHeader && (
          <h3
            className="text-[10px] font-medium tracking-[0.2em] mb-3"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            COLLECTION
          </h3>
        )}

        {/* Active tag filter indicator */}
        {tagFilter && (
          <div
            className="flex items-center justify-between px-2 py-1 rounded mb-2"
            style={{ background: 'rgba(188, 179, 163, 0.2)', border: '1px solid var(--pale-stone)' }}
          >
            <span className="text-[11px]" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
              #{tagFilter}
            </span>
            <button
              onClick={() => setTagFilter(null)}
              className="text-[10px] hover:opacity-70 transition-opacity"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              clear
            </button>
          </div>
        )}

        {/* Filter input */}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md mb-4"
          style={{
            background: 'rgba(188, 179, 163, 0.15)',
            border: '1px solid rgba(206, 204, 202, 0.5)',
          }}
        >
          <Search className="w-3 h-3 shrink-0" style={{ color: 'var(--silica)' }} />
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter notes..."
            className="text-[11px] bg-transparent outline-none w-full"
            style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          />
        </div>

        {/* Note and folder tree */}
        <div className="space-y-1">
          {/* Root notes grouped by type */}
          {typeOrder.map((type) => {
            const group = notesByType.get(type);
            if (!group || group.length === 0) return null;
            const config = NOTE_TYPE_CONFIG[type];
            const TypeIcon = config.icon;
            const isExpanded = typeGroupsExpanded[type] ?? true;
            return (
              <div key={type} className="mb-1">
                <button
                  className="flex items-center gap-1.5 w-full px-1 py-1 rounded hover:bg-black/5 transition-colors cursor-pointer"
                  onClick={() => setTypeGroupsExpanded((prev) => ({ ...prev, [type]: !prev[type] }))}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--silica)' }} />
                  ) : (
                    <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--silica)' }} />
                  )}
                  <TypeIcon className="w-3 h-3 shrink-0" style={{ color: config.color }} />
                  <span
                    className="text-[10px] font-medium tracking-[0.15em]"
                    style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {config.label.toUpperCase()}
                  </span>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                    {group.length}
                  </span>
                </button>
                {isExpanded && (
                  <div className="ml-2">
                    {group.map((note) => (
                      <NoteItem
                        key={note.id}
                        note={note}
                        isActive={note.id === activeNoteId}
                        folders={folders}
                        onOpen={openNote}
                        onRename={(id, title) => renameNote(id, title)}
                        onDuplicate={(id) => duplicateNote(id)}
                        onDelete={(id) => deleteNote(id)}
                        onMove={(noteId, fId) => moveNote(noteId, fId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Root folders */}
          {rootFolders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              notes={notes}
              allFolders={folders}
              activeNoteId={activeNoteId}
              filterText={filterText}
              tagFilter={tagFilter}
              onOpen={openNote}
              onCreateNote={(fId, type) => createNote(fId, type)}
              onRenameNote={(id, title) => renameNote(id, title)}
              onDuplicateNote={(id) => duplicateNote(id)}
              onDeleteNote={(id) => deleteNote(id)}
              onMoveNote={(noteId, fId) => moveNote(noteId, fId)}
              onRenameFolder={(id, name) => renameFolder(id, name)}
              onDeleteFolder={(id) => deleteFolder(id)}
              onCreateSubfolder={(parentId, name) => createFolder(name, parentId)}
            />
          ))}
        </div>

        {/* + New Folder button */}
        <button
          onClick={() => setShowNewFolder(true)}
          className="flex items-center gap-1.5 mt-4 px-2 py-1.5 rounded hover:bg-black/5 transition-colors w-full"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          <FolderPlus className="w-3.5 h-3.5" style={{ color: 'var(--silica)' }} />
          <span className="text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            + New Folder
          </span>
        </button>

        <NewFolderDialog open={showNewFolder} onOpenChange={setShowNewFolder} />

        {/* Tags section */}
        {allTags.length > 0 && (
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(206, 204, 202, 0.5)' }}>
            <button
              className="flex items-center gap-1 w-full cursor-pointer hover:bg-black/5 rounded px-1 py-0.5 transition-colors"
              onClick={() => setTagsExpanded(!tagsExpanded)}
            >
              {tagsExpanded ? (
                <ChevronDown className="w-3 h-3" style={{ color: 'var(--silica)' }} />
              ) : (
                <ChevronRight className="w-3 h-3" style={{ color: 'var(--silica)' }} />
              )}
              <h3
                className="text-[10px] font-medium tracking-[0.2em]"
                style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
              >
                TAGS
              </h3>
              <span className="text-[10px] ml-1" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                ({allTags.length})
              </span>
            </button>
            {tagsExpanded && (
              <div className="space-y-1.5 mt-2">
                {allTags.map(([tag, count]) => {
                  const isActive = tagFilter === tag;
                  return (
                    <div
                      key={tag}
                      className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-black/5 transition-colors"
                      style={{
                        background: isActive ? 'rgba(188, 179, 163, 0.3)' : 'transparent',
                        fontFamily: 'Outfit, sans-serif',
                      }}
                      onClick={() => setTagFilter(isActive ? null : tag)}
                    >
                      <span
                        className="text-[11px]"
                        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                      >
                        #{tag}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--silica)' }}>
                        ({count})
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
