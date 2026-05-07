import { describe, it, expect, beforeEach } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AccountProfile } from './account-profile';
import { AuthSession } from '../session/auth-session';
import { FakeStorageAdapter } from '@/notepad/collection/fake-storage-adapter';
import type { StorageAdapter } from '@/notepad/storage/adapter';

// ── Fake Supabase client (the surface AuthSession + AccountProfile touch) ──

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

class FakeProfilesTable {
  rows: ProfileRow[] = [];
  fetchError: { message: string } | null = null;
  uploadCalls: Array<{ path: string; upsert: boolean }> = [];
  removeCalls: string[][] = [];
  updateCalls: Array<{ id: string; updates: Record<string, unknown> }> = [];
  deleteCalls: string[] = [];
}

function makeFakeClient(table: FakeProfilesTable): { client: SupabaseClient; auth: FakeSupabaseAuth } {
  const auth = new FakeSupabaseAuth();
  const client = {
    auth,
    from(name: string) {
      if (name !== 'profiles') throw new Error(`Unexpected table: ${name}`);
      return {
        select() {
          return {
            eq(_col: string, id: string) {
              return {
                async maybeSingle() {
                  if (table.fetchError) return { data: null, error: table.fetchError };
                  const row = table.rows.find((r) => r.id === id) ?? null;
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        update(updates: Record<string, unknown>) {
          return {
            async eq(_col: string, id: string) {
              table.updateCalls.push({ id, updates });
              const row = table.rows.find((r) => r.id === id);
              if (row) Object.assign(row, updates);
              return { error: null };
            },
          };
        },
        delete() {
          return {
            async eq(_col: string, id: string) {
              table.deleteCalls.push(id);
              table.rows = table.rows.filter((r) => r.id !== id);
              return { error: null };
            },
          };
        },
      };
    },
    storage: {
      from(_bucket: string) {
        return {
          async upload(path: string, _file: unknown, options: { upsert?: boolean }) {
            table.uploadCalls.push({ path, upsert: options.upsert ?? false });
            return { error: null };
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: `https://cdn.test/${path}` } };
          },
          async remove(paths: string[]) {
            table.removeCalls.push(paths);
            return { error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  return { client, auth };
}

class FakeSupabaseAuth {
  listeners: AuthListener[] = [];
  initialSession: { user: User } | null = null;
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
    for (const l of [...this.listeners]) l('SIGNED_OUT', null);
    return { error: null };
  }
  emit(event: string, session: { user: User } | null) {
    for (const l of [...this.listeners]) l(event, session);
  }
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
    full_name: 'Alice Doe',
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

// ── Tests ───────────────────────────────────────────────────────────────────

describe('AccountProfile — initial state', () => {
  let local: StorageAdapter;
  let table: FakeProfilesTable;

  beforeEach(() => {
    local = new FakeStorageAdapter();
    table = new FakeProfilesTable();
  });

  it('starts with no profile and status=missing before init', () => {
    const { client } = makeFakeClient(table);
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    expect(profile.getSnapshot()).toEqual({ profile: null, profileStatus: 'missing' });
  });
});

describe('AccountProfile — fetch on session', () => {
  let local: StorageAdapter;
  let table: FakeProfilesTable;

  beforeEach(() => {
    local = new FakeStorageAdapter();
    table = new FakeProfilesTable();
  });

  it('fetches and maps a profile when the user becomes available', async () => {
    const { client, auth } = makeFakeClient(table);
    table.rows.push(makeRow({ id: 'user-1', full_name: 'Alice' }));
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await flush();
    auth.emit('SIGNED_IN', { user: makeUser('user-1') });
    await flush();
    const snap = profile.getSnapshot();
    expect(snap.profileStatus).toBe('loaded');
    expect(snap.profile?.fullName).toBe('Alice');
  });

  it('reports status=missing when the row does not exist', async () => {
    const { client, auth } = makeFakeClient(table);
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await flush();
    auth.emit('SIGNED_IN', { user: makeUser('ghost') });
    await flush();
    const snap = profile.getSnapshot();
    expect(snap.profile).toBeNull();
    expect(snap.profileStatus).toBe('missing');
  });

  it('reports status=error when the fetch throws', async () => {
    const { client, auth } = makeFakeClient(table);
    table.fetchError = { message: 'boom' };
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await flush();
    auth.emit('SIGNED_IN', { user: makeUser('user-1') });
    await flush();
    expect(profile.getSnapshot().profileStatus).toBe('error');
  });

  it('clears profile to missing when the user signs out', async () => {
    const { client, auth } = makeFakeClient(table);
    table.rows.push(makeRow({ id: 'user-1' }));
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await flush();
    auth.emit('SIGNED_IN', { user: makeUser('user-1') });
    await flush();
    expect(profile.getSnapshot().profileStatus).toBe('loaded');
    auth.emit('SIGNED_OUT', null);
    await flush();
    expect(profile.getSnapshot()).toEqual({ profile: null, profileStatus: 'missing' });
  });

  it('does not refetch on same-id session events (token refresh)', async () => {
    const { client, auth } = makeFakeClient(table);
    table.rows.push(makeRow({ id: 'user-1' }));
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await flush();
    auth.emit('SIGNED_IN', { user: makeUser('user-1') });
    await flush();
    let fetches = 0;
    const origFrom = (client as any).from;
    (client as any).from = (...args: unknown[]) => {
      fetches++;
      return origFrom(...args);
    };
    auth.emit('TOKEN_REFRESHED', { user: makeUser('user-1') });
    await flush();
    expect(fetches).toBe(0);
  });
});

describe('AccountProfile — mutations', () => {
  let local: StorageAdapter;
  let table: FakeProfilesTable;

  beforeEach(() => {
    local = new FakeStorageAdapter();
    table = new FakeProfilesTable();
  });

  it('updateProfile maps camelCase → snake_case and refetches', async () => {
    const { client, auth } = makeFakeClient(table);
    table.rows.push(makeRow({ id: 'user-1' }));
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await flush();
    auth.emit('SIGNED_IN', { user: makeUser('user-1') });
    await flush();
    await profile.updateProfile({ fullName: 'Renamed', dateOfBirth: '1990-05-01' });
    expect(table.updateCalls[0]).toEqual({
      id: 'user-1',
      updates: { full_name: 'Renamed', date_of_birth: '1990-05-01' },
    });
    expect(profile.getSnapshot().profile?.fullName).toBe('Renamed');
  });

  it('updateProfile throws when not authenticated', async () => {
    const { client } = makeFakeClient(table);
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await expect(profile.updateProfile({ fullName: 'X' })).rejects.toThrow(/not authenticated/i);
  });

  it('uploadAvatar uploads and writes back avatarUrl', async () => {
    const { client, auth } = makeFakeClient(table);
    table.rows.push(makeRow({ id: 'user-1' }));
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await flush();
    auth.emit('SIGNED_IN', { user: makeUser('user-1') });
    await flush();
    const fakeFile = { name: 'me.png' } as unknown as File;
    const url = await profile.uploadAvatar(fakeFile);
    expect(url).toBe('https://cdn.test/user-1/avatar.png');
    expect(table.uploadCalls).toEqual([{ path: 'user-1/avatar.png', upsert: true }]);
    expect(table.updateCalls[0]?.updates).toEqual({ avatar_url: 'https://cdn.test/user-1/avatar.png' });
  });

  it('refreshProfile no-ops when there is no user', async () => {
    const { client } = makeFakeClient(table);
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await profile.refreshProfile();
    expect(profile.getSnapshot().profileStatus).toBe('missing');
  });
});
