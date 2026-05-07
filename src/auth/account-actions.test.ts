import { describe, it, expect, beforeEach } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthSession } from './session/auth-session';
import { AccountProfile } from './profile/account-profile';
import { AccountActions } from './account-actions';
import { FakeStorageAdapter } from '@/notepad/collection/fake-storage-adapter';

interface AuthListener {
  (event: string, session: { user: User } | null): void;
}

interface ProfileRow {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  note_count: number;
  highest_note_count: number;
  created_at: string;
  updated_at: string;
}

class FakeSupabaseAuth {
  listeners: AuthListener[] = [];
  initialSession: { user: User } | null = null;
  signOutCalls = 0;
  async getSession() {
    return { data: { session: this.initialSession }, error: null };
  }
  onAuthStateChange(listener: AuthListener) {
    this.listeners.push(listener);
    return {
      data: {
        subscription: {
          id: 'sub',
          callback: listener,
          unsubscribe: () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
          },
        },
      },
    };
  }
  async signUp() { return { error: null }; }
  async signInWithPassword() { return { error: null }; }
  async signInWithOAuth() { return { error: null }; }
  async signOut() {
    this.signOutCalls++;
    for (const l of [...this.listeners]) l('SIGNED_OUT', null);
    return { error: null };
  }
  emit(event: string, session: { user: User } | null) {
    for (const l of [...this.listeners]) l(event, session);
  }
}

interface FakeBackend {
  rows: ProfileRow[];
  removeCalls: string[][];
  deleteCalls: string[];
  auth: FakeSupabaseAuth;
}

function makeFakeClient(): { client: SupabaseClient; backend: FakeBackend } {
  const auth = new FakeSupabaseAuth();
  const backend: FakeBackend = {
    rows: [],
    removeCalls: [],
    deleteCalls: [],
    auth,
  };
  const client = {
    auth,
    from(_name: string) {
      return {
        select() {
          return {
            eq(_col: string, id: string) {
              return {
                async maybeSingle() {
                  const row = backend.rows.find((r) => r.id === id) ?? null;
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        update(_updates: Record<string, unknown>) {
          return { async eq() { return { error: null }; } };
        },
        delete() {
          return {
            async eq(_col: string, id: string) {
              backend.deleteCalls.push(id);
              backend.rows = backend.rows.filter((r) => r.id !== id);
              return { error: null };
            },
          };
        },
      };
    },
    storage: {
      from(_bucket: string) {
        return {
          async remove(paths: string[]) {
            backend.removeCalls.push(paths);
            return { error: null };
          },
          async upload() { return { error: null }; },
          getPublicUrl(path: string) { return { data: { publicUrl: `https://cdn.test/${path}` } }; },
        };
      },
    },
  } as unknown as SupabaseClient;
  return { client, backend };
}

function makeUser(id: string): User {
  return {
    id,
    email: `${id}@example.com`,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  } as User;
}

class FakeOAuthProbe {
  hasCallbackParams() { return false; }
  stripCallbackParams() {}
}

function makeRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: 'user-1',
    full_name: 'Alice',
    date_of_birth: null,
    avatar_url: null,
    note_count: 0,
    highest_note_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('AccountActions — deleteAccount sequencing', () => {
  let local: FakeStorageAdapter;
  let backend: FakeBackend;
  let session: AuthSession;
  let profile: AccountProfile;
  let actions: AccountActions;

  beforeEach(async () => {
    local = new FakeStorageAdapter();
    const { client, backend: b } = makeFakeClient();
    backend = b;
    session = new AuthSession(client, local, new FakeOAuthProbe());
    profile = new AccountProfile(client, session);
    actions = new AccountActions(client, session, profile);
    session.init();
    profile.init();
    await flush();
  });

  it('throws when no user is signed in', async () => {
    await expect(actions.deleteAccount()).rejects.toThrow(/not authenticated/i);
  });

  it('deletes the profile row and signs out (no avatar case)', async () => {
    backend.rows.push(makeRow({ id: 'user-1', avatar_url: null }));
    backend.auth.emit('SIGNED_IN', { user: makeUser('user-1') });
    await flush();
    await actions.deleteAccount();
    expect(backend.removeCalls).toEqual([]); // no avatar → no storage delete
    expect(backend.deleteCalls).toEqual(['user-1']);
    expect(backend.auth.signOutCalls).toBe(1);
    expect(session.getSnapshot().user).toBeNull();
    expect(session.getSnapshot().adapter).toBe(local);
  });

  it('removes avatar files before deleting the profile row when an avatar exists', async () => {
    backend.rows.push(makeRow({ id: 'user-1', avatar_url: 'https://cdn.test/user-1/avatar.png' }));
    backend.auth.emit('SIGNED_IN', { user: makeUser('user-1') });
    await flush();
    await actions.deleteAccount();
    expect(backend.removeCalls).toEqual([['user-1/']]);
    expect(backend.deleteCalls).toEqual(['user-1']);
  });
});

describe('AccountActions — exportData', () => {
  let local: FakeStorageAdapter;
  let backend: FakeBackend;
  let session: AuthSession;
  let profile: AccountProfile;
  let actions: AccountActions;

  beforeEach(async () => {
    local = new FakeStorageAdapter();
    const { client, backend: b } = makeFakeClient();
    backend = b;
    session = new AuthSession(client, local, new FakeOAuthProbe());
    profile = new AccountProfile(client, session);
    actions = new AccountActions(client, session, profile);
    session.init();
    profile.init();
    await flush();
  });

  it('returns notes and folders from the active adapter', async () => {
    local.notes.push({
      id: 'n1', title: 'A', content: '', folderId: 'root', type: 'devotion',
      tags: [], wordCount: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    });
    local.folders.push({ id: 'f1', name: 'F', parentId: null, order: 0 });
    const out = await actions.exportData();
    expect(out.notes).toHaveLength(1);
    expect(out.folders).toHaveLength(1);
    // Make backend referenced so lint doesn't drop the variable.
    expect(backend).toBeDefined();
  });
});
