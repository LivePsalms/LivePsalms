export type NoteType = 'devotion' | 'sermon' | 'theme';

export interface NoteDecoration {
  id: string;        // local uuid
  assetId: string;   // manifest id
  xPct: number;      // 0..1, left position as a fraction of content width
  yPct: number;      // 0..1, top position as a fraction of content width (uniform zoom)
  widthPct: number;  // 0..1, width as a fraction of content width
  rotation: number;  // degrees
  z: number;         // stacking order
  /** Legacy (pre-uniform-zoom): absolute px top. Read only during migration. */
  yPx?: number;
  behindText?: boolean; // when true, renders behind editor text (default = in front of text)
  flipH?: boolean;   // horizontal flip
  flipV?: boolean;   // vertical flip
}

export interface Note {
  id: string;
  title: string;
  content: string; // TipTap JSON stringified
  folderId: string;
  type: NoteType;
  tags: string[];
  decorations?: NoteDecoration[];
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
