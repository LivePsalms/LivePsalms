export interface ScriptureNode {
  id: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
  translation: string;
  text: string;
  createdAt: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'explicit' | 'scripture_reference' | 'cross_reference';
  weight: number;
  createdAt: string;
}

export interface GraphNode {
  id: string;
  type: 'devotion' | 'sermon' | 'theme' | 'scripture';
  title: string;
  weight: number;
  tags: string[];
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export type AdjacencyList = Map<string, {
  outgoing: GraphEdge[];
  incoming: GraphEdge[];
}>;
