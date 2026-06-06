export type NoteType = 'devotion' | 'sermon' | 'theme';

export interface Note {
  id: string;
  title: string;
  content: string; // TipTap JSON stringified
  folderId: string;
  type: NoteType;
  tags: string[];
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export type FolderIcon =
  | 'heart' | 'star' | 'cross' | 'flame' | 'dove' | 'crown'
  | 'book' | 'music' | 'sun' | 'shield' | 'lamp' | 'wheat';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  icon?: FolderIcon;
  color?: string;
}

export type { ScriptureNode, GraphEdge, GraphNode, AdjacencyList } from './graph/types';
