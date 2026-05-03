import { v4 as uuidv4 } from 'uuid';
import type { GraphEdge } from './types';

const STORAGE_KEY = 'notepad_graph_edges';

function read(): GraphEdge[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function write(edges: GraphEdge[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edges));
}

export function getAllEdges(): GraphEdge[] {
  return read();
}

export function getEdgesBySource(nodeId: string): GraphEdge[] {
  return read().filter((e) => e.source === nodeId);
}

export function getEdgesByTarget(nodeId: string): GraphEdge[] {
  return read().filter((e) => e.target === nodeId);
}

export function createEdge(edge: Omit<GraphEdge, 'id' | 'createdAt'>): GraphEdge {
  const edges = read();
  const existing = edges.find(
    (e) => e.source === edge.source && e.target === edge.target && e.type === edge.type
  );
  if (existing) return existing;

  const created: GraphEdge = { ...edge, id: uuidv4(), createdAt: new Date().toISOString() };
  edges.push(created);
  write(edges);
  return created;
}

export function deleteEdgesBySource(nodeId: string): void {
  write(read().filter((e) => e.source !== nodeId));
}

export function deleteEdge(id: string): void {
  write(read().filter((e) => e.id !== id));
}

export function deleteEdgesForNode(nodeId: string): void {
  write(read().filter((e) => e.source !== nodeId && e.target !== nodeId));
}
