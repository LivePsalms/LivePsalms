import { describe, it, expect } from 'vitest';
import {
  readExpanded,
  toggleInOverrides,
  readPersistedOverrides,
  writePersistedOverrides,
  STORAGE_KEY,
  type TreeViewOverrides,
} from './tree-view-state';

function createInMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> & {
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
}

// ---------------------------------------------------------------------------
// readExpanded
// ---------------------------------------------------------------------------

describe('readExpanded', () => {
  it('falls back to the default when the key is absent', () => {
    expect(readExpanded({}, 'folder:a', true)).toBe(true);
    expect(readExpanded({}, 'tags', false)).toBe(false);
  });

  it('returns the explicit override when the key is present', () => {
    const overrides: TreeViewOverrides = { 'folder:a': false };
    expect(readExpanded(overrides, 'folder:a', true)).toBe(false);
  });

  it('treats `false` as a real value, not a missing override', () => {
    const overrides: TreeViewOverrides = { 'tags': false };
    expect(readExpanded(overrides, 'tags', true)).toBe(false);
  });

  it('treats `true` overrides separately from defaults', () => {
    const overrides: TreeViewOverrides = { 'tags': true };
    expect(readExpanded(overrides, 'tags', false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toggleInOverrides
// ---------------------------------------------------------------------------

describe('toggleInOverrides — first toggle', () => {
  it('writes `false` into overrides when default is `true`', () => {
    expect(toggleInOverrides({}, 'folder:a', true)).toEqual({ 'folder:a': false });
  });

  it('writes `true` into overrides when default is `false`', () => {
    expect(toggleInOverrides({}, 'tags', false)).toEqual({ 'tags': true });
  });
});

describe('toggleInOverrides — follow-up toggle', () => {
  it('flips an existing `false` override to `true`', () => {
    expect(toggleInOverrides({ 'folder:a': false }, 'folder:a', true)).toEqual({
      'folder:a': true,
    });
  });

  it('flips an existing `true` override to `false`', () => {
    expect(toggleInOverrides({ 'folder:a': true }, 'folder:a', true)).toEqual({
      'folder:a': false,
    });
  });

  it('flips back to the inverse of the default after one toggle', () => {
    // Default true → toggle once → false → toggle again → true (back to default)
    const after1 = toggleInOverrides({}, 'folder:a', true);
    const after2 = toggleInOverrides(after1, 'folder:a', true);
    expect(after2['folder:a']).toBe(true);
  });
});

describe('toggleInOverrides — immutability and isolation', () => {
  it('does not mutate the input overrides', () => {
    const overrides: TreeViewOverrides = { 'folder:a': true };
    const before = { ...overrides };
    toggleInOverrides(overrides, 'folder:a', true);
    expect(overrides).toEqual(before);
  });

  it('does not affect unrelated keys', () => {
    const overrides: TreeViewOverrides = { 'folder:a': false, 'tags': true };
    const next = toggleInOverrides(overrides, 'folder:a', true);
    expect(next['tags']).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('readPersistedOverrides', () => {
  it('returns {} when the key is missing', () => {
    const storage = createInMemoryStorage();
    expect(readPersistedOverrides(storage)).toEqual({});
  });

  it('returns the parsed value for valid persisted JSON', () => {
    const storage = createInMemoryStorage();
    storage.store.set(STORAGE_KEY, JSON.stringify({ 'folder:a': false, 'tags': true }));
    expect(readPersistedOverrides(storage)).toEqual({ 'folder:a': false, 'tags': true });
  });

  it('returns {} for malformed JSON without throwing', () => {
    const storage = createInMemoryStorage();
    storage.store.set(STORAGE_KEY, '{not json');
    expect(() => readPersistedOverrides(storage)).not.toThrow();
    expect(readPersistedOverrides(storage)).toEqual({});
  });

  it('drops non-boolean values defensively', () => {
    const storage = createInMemoryStorage();
    storage.store.set(
      STORAGE_KEY,
      JSON.stringify({ 'folder:a': true, 'folder:b': 'yes', 'folder:c': 1, 'tags': false }),
    );
    expect(readPersistedOverrides(storage)).toEqual({ 'folder:a': true, 'tags': false });
  });

  it('returns {} for non-object JSON values', () => {
    const storage = createInMemoryStorage();
    storage.store.set(STORAGE_KEY, JSON.stringify(['a', 'b']));
    expect(readPersistedOverrides(storage)).toEqual({});
    storage.store.set(STORAGE_KEY, JSON.stringify('a string'));
    expect(readPersistedOverrides(storage)).toEqual({});
    storage.store.set(STORAGE_KEY, JSON.stringify(null));
    expect(readPersistedOverrides(storage)).toEqual({});
  });
});

describe('writePersistedOverrides', () => {
  it('writes the JSON-encoded overrides under STORAGE_KEY', () => {
    const storage = createInMemoryStorage();
    writePersistedOverrides(storage, { 'folder:a': false, 'tags': true });
    expect(storage.store.get(STORAGE_KEY)).toBe(
      JSON.stringify({ 'folder:a': false, 'tags': true }),
    );
  });

  it('swallows storage errors (quota exceeded, etc.) without crashing', () => {
    const failing: Pick<Storage, 'setItem'> = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => writePersistedOverrides(failing, { 'tags': true })).not.toThrow();
  });

  it('round-trips: write then read returns the same overrides', () => {
    const storage = createInMemoryStorage();
    const original: TreeViewOverrides = { 'folder:a': true, 'folder:b': false, 'tags': true };
    writePersistedOverrides(storage, original);
    expect(readPersistedOverrides(storage)).toEqual(original);
  });
});
