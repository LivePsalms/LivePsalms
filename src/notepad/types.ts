export type NoteType = 'devotion' | 'sermon' | 'theme';

export interface Note {
  id: string;
  title: string;
  content: string; // TipTap JSON stringified
  folderId: string;
  type: NoteType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
}
