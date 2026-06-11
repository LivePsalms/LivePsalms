import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import {
  firstNameOf,
  welcomedOnceKey,
  hasBeenWelcomedOnce,
  markWelcomedOnce,
  decideFirstLoadActions,
} from './notepad-first-load';

interface FakeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  data: Map<string, string>;
}

function makeFakeStorage(): FakeStorage {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as User;
}

describe('firstNameOf', () => {
  it('returns the first word of full_name when present', () => {
    const user = makeUser({ id: 'u1', user_metadata: { full_name: 'Ada Lovelace' } });
    expect(firstNameOf(user)).toBe('Ada');
  });

  it('returns just the full_name when it has no spaces', () => {
    const user = makeUser({ id: 'u1', user_metadata: { full_name: 'Plato' } });
    expect(firstNameOf(user)).toBe('Plato');
  });

  it('falls back to the email local-part when full_name is empty', () => {
    const user = makeUser({ id: 'u1', email: 'grace@hopper.dev', user_metadata: {} });
    expect(firstNameOf(user)).toBe('grace');
  });

  it('returns null when neither full_name nor email is available', () => {
    const user = makeUser({ id: 'u1', email: undefined, user_metadata: {} });
    expect(firstNameOf(user)).toBeNull();
  });

  it('falls back to email when full_name is whitespace only', () => {
    const user = makeUser({
      id: 'u1',
      email: 'ada@ex.com',
      user_metadata: { full_name: '   ' },
    });
    expect(firstNameOf(user)).toBe('ada');
  });
});

describe('welcomed-once storage', () => {
  it('welcomedOnceKey embeds the user id (no date)', () => {
    expect(welcomedOnceKey('user-42')).toBe('welcomed_once_user-42');
  });

  it('hasBeenWelcomedOnce returns false when the key is absent', () => {
    const storage = makeFakeStorage();
    expect(hasBeenWelcomedOnce('u1', storage)).toBe(false);
  });

  it('returns true after markWelcomedOnce for the same user', () => {
    const storage = makeFakeStorage();
    markWelcomedOnce('u1', storage);
    expect(hasBeenWelcomedOnce('u1', storage)).toBe(true);
  });

  it('is scoped per-user', () => {
    const storage = makeFakeStorage();
    markWelcomedOnce('u1', storage);
    expect(hasBeenWelcomedOnce('u2', storage)).toBe(false);
  });
});

describe('decideFirstLoadActions — gating', () => {
  it('returns no actions while authLoading', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: true,
        profileLoading: false,
        hasBeenWelcomed: false,
        hasBeenWelcomedOnce: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });

  it('returns no actions when user is null', () => {
    expect(
      decideFirstLoadActions({
        user: null,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });

  it('returns no actions while profileLoading', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: true,
        hasBeenWelcomed: false,
        hasBeenWelcomedOnce: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });
});

describe('decideFirstLoadActions — welcome redirect short-circuits the greeting', () => {
  it('first sign-in (no welcomed flag): emits redirect-welcome only', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: false,
        hasBeenWelcomedOnce: false,
        localNoteCount: 0,
      }),
    ).toEqual([{ kind: 'redirect-welcome' }]);
  });

  it('first sign-in with local notes: emits redirect-welcome AND offer-migration', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: false,
        hasBeenWelcomedOnce: false,
        localNoteCount: 3,
      }),
    ).toEqual([{ kind: 'redirect-welcome' }, { kind: 'offer-migration' }]);
  });
});

describe('decideFirstLoadActions — one-time welcome', () => {
  it('welcomed and not welcomed-once: emits welcome with firstName', () => {
    const user = makeUser({
      id: 'u1',
      user_metadata: { full_name: 'Grace Hopper' },
      email: 'grace@hopper.dev',
    });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: false,
        localNoteCount: 0,
      }),
    ).toEqual([{ kind: 'welcome', firstName: 'Grace' }]);
  });

  it('emits welcome with firstName: null when user has no name or email', () => {
    const user = makeUser({ id: 'u1', email: undefined, user_metadata: {} });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: false,
        localNoteCount: 0,
      }),
    ).toEqual([{ kind: 'welcome', firstName: null }]);
  });

  it('welcomed and already welcomed-once: emits no greeting', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: true,
        localNoteCount: 0,
      }),
    ).toEqual([]);
  });

  it('welcomed, not welcomed-once, with local notes: emits welcome AND offer-migration in order', () => {
    const user = makeUser({ id: 'u1', email: 'ada@ex.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: false,
        localNoteCount: 1,
      }),
    ).toEqual([{ kind: 'welcome', firstName: 'ada' }, { kind: 'offer-migration' }]);
  });

  it('welcomed, already welcomed-once, with local notes: emits offer-migration only', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: true,
        localNoteCount: 7,
      }),
    ).toEqual([{ kind: 'offer-migration' }]);
  });
});
