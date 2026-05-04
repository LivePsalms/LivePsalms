import { getAllScriptureNodes } from './scripture-store';
import { createEdge } from './edge-store';

let tskData: Record<string, string[]> | null = null;

async function loadTskData(): Promise<Record<string, string[]>> {
  if (tskData) return tskData;
  const module = await import('./tsk-data.json');
  tskData = module.default as Record<string, string[]>;
  return tskData;
}

function stripPrefix(id: string): string {
  return id.startsWith('scripture:') ? id.slice('scripture:'.length) : id;
}

export async function createCrossReferenceEdges(newScriptureId: string): Promise<void> {
  const tsk = await loadTskData();
  const existingNodes = getAllScriptureNodes();
  const existingIds = new Set(existingNodes.map((n) => n.id));

  const newKey = stripPrefix(newScriptureId);

  // 1. New verse's cross-refs -> existing scripture nodes
  const newCrossRefs = tsk[newKey] ?? [];
  for (const crossRef of newCrossRefs) {
    const targetId = `scripture:${crossRef}`;
    if (existingIds.has(targetId) && targetId !== newScriptureId) {
      createEdge({
        source: newScriptureId,
        target: targetId,
        type: 'cross_reference',
        weight: 0.5,
      });
    }
  }

  // 2. Existing nodes' cross-refs -> new verse
  for (const existing of existingNodes) {
    if (existing.id === newScriptureId) continue;
    const existingKey = stripPrefix(existing.id);
    const existingCrossRefs = tsk[existingKey] ?? [];
    if (existingCrossRefs.includes(newKey)) {
      createEdge({
        source: existing.id,
        target: newScriptureId,
        type: 'cross_reference',
        weight: 0.5,
      });
    }
  }
}
