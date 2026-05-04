import { useEffect, useRef, useState, useCallback } from 'react';
import type { Note } from '../types';
import type { GraphNode, GraphEdge } from './types';
import { parseEdgesFromContent, parseVerseRef } from './edge-parser';
import { getAllEdges, createEdge, deleteEdgesBySource, deleteEdgesForNode } from './edge-store';
import { getAllScriptureNodes, createScriptureNode, scriptureNodeExists } from './scripture-store';
import { buildAdjacencyList, computeNodeWeights } from './adjacency-list';
import { fetchVerseText } from '../extensions/bible-verse-utils';

export interface UseGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeNodeId: string | null;
  isLoading: boolean;
  rebuildGraph: () => void;
}

async function syncNoteEdges(note: Note): Promise<void> {
  const { edges: parsedEdges, scriptureRefs } = parseEdgesFromContent(note.id, note.content);

  deleteEdgesBySource(note.id);

  for (const ref of scriptureRefs) {
    if (!scriptureNodeExists(ref.id)) {
      const parsed = parseVerseRef(ref.ref);
      if (parsed) {
        let text = '';
        try {
          const result = await fetchVerseText(ref.ref);
          if (result) text = result.text;
        } catch {
          // Bible API unavailable — node created with empty text
        }
        createScriptureNode({
          id: ref.id,
          book: parsed.book,
          chapter: parsed.chapter,
          verseStart: parsed.verseStart,
          verseEnd: parsed.verseEnd,
          translation: 'WEB',
          text,
        });
      }
    }
  }

  for (const edge of parsedEdges) {
    createEdge({
      source: note.id,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
    });
  }
}

export function useGraph(notes: Note[], activeNoteId: string | null): UseGraphResult {
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const prevContentsRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);

  const buildFullGraph = useCallback(() => {
    const allEdges = getAllEdges();
    const scriptureNodes = getAllScriptureNodes();
    const adjacency = buildAdjacencyList(allEdges);
    const weights = computeNodeWeights(adjacency);

    const nodes: GraphNode[] = notes.map((note) => ({
      id: note.id,
      type: note.type,
      title: note.title,
      weight: weights.get(note.id) ?? 0,
      tags: note.tags,
    }));

    for (const sn of scriptureNodes) {
      if (adjacency.has(sn.id)) {
        nodes.push({
          id: sn.id,
          type: 'scripture',
          title: `${sn.book} ${sn.chapter}:${sn.verseStart}${sn.verseEnd ? `-${sn.verseEnd}` : ''}`,
          weight: weights.get(sn.id) ?? 0,
          tags: [],
        });
      }
    }

    setGraphNodes(nodes);
    setGraphEdges(allEdges);
    setIsLoading(false);
  }, [notes]);

  useEffect(() => {
    if (initializedRef.current || notes.length === 0) {
      if (notes.length === 0) setIsLoading(false);
      return;
    }
    initializedRef.current = true;

    async function initialBuild() {
      setIsLoading(true);
      for (const note of notes) {
        await syncNoteEdges(note);
      }
      const map = new Map<string, string>();
      for (const note of notes) map.set(note.id, note.content);
      prevContentsRef.current = map;
      buildFullGraph();
    }

    initialBuild();
  }, [notes, buildFullGraph]);

  useEffect(() => {
    if (!initializedRef.current || isLoading) return;

    const currentIds = new Set(notes.map((n) => n.id));

    const changedNotes: Note[] = [];
    for (const note of notes) {
      const prev = prevContentsRef.current.get(note.id);
      if (prev !== note.content) {
        changedNotes.push(note);
      }
    }

    const deletedIds: string[] = [];
    for (const prevId of prevContentsRef.current.keys()) {
      if (!currentIds.has(prevId)) {
        deletedIds.push(prevId);
      }
    }

    const map = new Map<string, string>();
    for (const note of notes) map.set(note.id, note.content);
    prevContentsRef.current = map;

    if (changedNotes.length === 0 && deletedIds.length === 0) return;

    async function syncChanges() {
      for (const id of deletedIds) {
        deleteEdgesForNode(id);
      }
      for (const note of changedNotes) {
        await syncNoteEdges(note);
      }
      buildFullGraph();
    }

    syncChanges();
  }, [notes, isLoading, buildFullGraph]);

  return {
    nodes: graphNodes,
    edges: graphEdges,
    activeNodeId: activeNoteId,
    isLoading,
    rebuildGraph: buildFullGraph,
  };
}
