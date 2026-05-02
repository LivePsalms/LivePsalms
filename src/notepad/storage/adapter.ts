import type { Note, Folder } from '../types';

export interface StorageAdapter {
  getNotes(): Promise<Note[]>;
  getNote(id: string): Promise<Note | null>;
  createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note>;
  updateNote(id: string, updates: Partial<Note>): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  duplicateNote(id: string): Promise<Note>;

  getFolders(): Promise<Folder[]>;
  createFolder(folder: Omit<Folder, 'id'>): Promise<Folder>;
  updateFolder(id: string, updates: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;
}
