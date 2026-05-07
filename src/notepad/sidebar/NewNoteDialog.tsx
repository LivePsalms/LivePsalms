import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NoteType } from '../types';

interface NewNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  onCreate: (folderId: string, type: NoteType) => void;
}

export function NewNoteDialog({ open, onOpenChange, folderId, onCreate }: NewNoteDialogProps) {
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
