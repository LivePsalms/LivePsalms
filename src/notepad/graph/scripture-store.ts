import type { ScriptureNode } from './types';

const STORAGE_KEY = 'notepad_scripture_nodes';

function read(): ScriptureNode[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function write(nodes: ScriptureNode[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
}

export function getAllScriptureNodes(): ScriptureNode[] {
  return read();
}

export function getScriptureNode(id: string): ScriptureNode | null {
  return read().find((n) => n.id === id) ?? null;
}

export function scriptureNodeExists(id: string): boolean {
  return read().some((n) => n.id === id);
}

export function createScriptureNode(node: Omit<ScriptureNode, 'createdAt'>): ScriptureNode {
  const nodes = read();
  if (nodes.some((n) => n.id === node.id)) return nodes.find((n) => n.id === node.id)!;
  const created: ScriptureNode = { ...node, createdAt: new Date().toISOString() };
  nodes.push(created);
  write(nodes);
  return created;
}

export function deleteScriptureNode(id: string): void {
  write(read().filter((n) => n.id !== id));
}
