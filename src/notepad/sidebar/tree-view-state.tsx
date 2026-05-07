import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * TreeViewState — centralizes expand/collapse state for the sidebar tree.
 *
 * Replaces three previously-scattered state holders:
 *   - `tagsExpanded` (top-level boolean)
 *   - `typeGroupsExpanded` (record by NoteType)
 *   - per-`FolderItem` `open` (one `useState` per folder, lost on unmount)
 *
 * Underlying state is a sparse `Record<string, boolean>` of OVERRIDES only.
 * Keys absent from the record fall back to the per-call default. This means
 * folders never explicitly toggled don't appear in state — and a folder
 * mounting/unmounting during search-filter changes doesn't clear its open
 * state.
 *
 * Persisted to `localStorage` under `STORAGE_KEY`, so expanded folders, type
 * groups, and the tags section survive a page refresh. The storage helpers
 * accept a `Pick<Storage, 'getItem' | 'setItem'>` so they're testable without
 * a DOM (mirrors the pattern in `ReferenceGraph`).
 *
 * Key conventions:
 *   - `folder:${folderId}` for each Folder row (defaultExpanded = true)
 *   - `type:${noteType}` for each NoteType group at root (defaultExpanded = true)
 *   - `tags` for the tags section at the bottom (defaultExpanded = false)
 */

export const STORAGE_KEY = 'notepad_tree_view_overrides';

export type TreeViewOverrides = Record<string, boolean>;

export interface TreeViewState {
  isExpanded: (key: string, defaultExpanded: boolean) => boolean;
  toggle: (key: string, defaultExpanded: boolean) => void;
}

// ---------------------------------------------------------------------------
// Pure helpers (testable in isolation)
// ---------------------------------------------------------------------------

export function readExpanded(
  overrides: TreeViewOverrides,
  key: string,
  defaultExpanded: boolean,
): boolean {
  return overrides[key] ?? defaultExpanded;
}

export function toggleInOverrides(
  overrides: TreeViewOverrides,
  key: string,
  defaultExpanded: boolean,
): TreeViewOverrides {
  const current = readExpanded(overrides, key, defaultExpanded);
  return { ...overrides, [key]: !current };
}

/**
 * Reads persisted overrides from a Storage-shaped backend. Returns `{}` if
 * the key is missing, the value isn't valid JSON, or the parsed value isn't
 * a plain record of booleans. Defensive — never throws.
 */
export function readPersistedOverrides(
  storage: Pick<Storage, 'getItem'>,
): TreeViewOverrides {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: TreeViewOverrides = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') result[k] = v;
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Writes overrides to a Storage-shaped backend. Defensive — swallows quota
 * errors and the like rather than crashing the sidebar.
 */
export function writePersistedOverrides(
  storage: Pick<Storage, 'setItem'>,
  overrides: TreeViewOverrides,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore — quota exceeded or storage unavailable
  }
}

// ---------------------------------------------------------------------------
// React surface
// ---------------------------------------------------------------------------

const TreeViewStateContext = createContext<TreeViewState | null>(null);

export function TreeViewStateProvider({ children }: { children: ReactNode }) {
  // Lazy init so the localStorage read happens once, on first mount.
  const [overrides, setOverrides] = useState<TreeViewOverrides>(() =>
    typeof localStorage !== 'undefined' ? readPersistedOverrides(localStorage) : {},
  );

  // Persist on every change. Declarative — runs whenever `overrides` updates.
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    writePersistedOverrides(localStorage, overrides);
  }, [overrides]);

  const isExpanded = useCallback(
    (key: string, defaultExpanded: boolean) => readExpanded(overrides, key, defaultExpanded),
    [overrides],
  );

  const toggle = useCallback((key: string, defaultExpanded: boolean) => {
    setOverrides((prev) => toggleInOverrides(prev, key, defaultExpanded));
  }, []);

  const value = useMemo<TreeViewState>(
    () => ({ isExpanded, toggle }),
    [isExpanded, toggle],
  );

  return <TreeViewStateContext.Provider value={value}>{children}</TreeViewStateContext.Provider>;
}

export function useTreeViewState(): TreeViewState {
  const ctx = useContext(TreeViewStateContext);
  if (!ctx) {
    throw new Error('useTreeViewState must be used inside <TreeViewStateProvider>');
  }
  return ctx;
}
