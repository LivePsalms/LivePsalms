export type NoteType = 'devotion' | 'sermon' | 'theme';

export type JournalTheme =
  | 'default'
  | 'pastel'
  | 'weekly'
  | 'hobonichi'
  | 'vintage'
  | 'sweet'
  | 'confetti';

export interface JournalThemeMeta {
  id: JournalTheme;
  label: string;
  description: string;
  swatch: string; // preview color for the picker
}

export const JOURNAL_THEMES: JournalThemeMeta[] = [
  { id: 'default', label: 'Default', description: 'Clean & minimal', swatch: '#F0ECE8' },
  { id: 'pastel', label: 'Pastel Bloom', description: 'Dotted paper, pink & mint', swatch: '#e07ba7' },
  { id: 'weekly', label: 'Weekly Marker', description: 'Color-coded daily spread', swatch: '#e8a93a' },
  { id: 'hobonichi', label: 'Hobonichi Ink', description: 'Grid paper, navy ink', swatch: '#1c2e4a' },
  { id: 'vintage', label: 'Vintage Cursive', description: 'Cream paper, sepia tones', swatch: '#8a6f4a' },
  { id: 'sweet', label: 'Sweet Affirmation', description: 'Lined paper, hot pink', swatch: '#d6126a' },
  { id: 'confetti', label: 'Marker Confetti', description: 'Multi-color highlighters', swatch: '#5bafc4' },
];

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
