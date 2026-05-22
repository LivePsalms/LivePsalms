import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import {
  firstNameOf,
  welcomedKey,
  greetedKey,
  hasBeenWelcomed,
  markWelcomed,
  hasBeenGreetedToday,
  markGreetedToday,
  todayDateString,
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

  it("falls back to 'friend' when neither full_name nor email is available", () => {
    const user = makeUser({ id: 'u1', email: undefined, user_metadata: {} });
    expect(firstNameOf(user)).toBe('friend');
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

describe('storage keys', () => {
  it('welcomedKey embeds the user id', () => {
    expect(welcomedKey('user-42')).toBe('welcomed_user-42');
  });

  it('greetedKey embeds the user id and date string', () => {
    expect(greetedKey('user-42', 'Wed May 07 2026')).toBe('greeted_user-42_Wed May 07 2026');
  });
});

describe('hasBeenWelcomed / markWelcomed', () => {
  it('returns false when the key is absent', () => {
    const storage = makeFakeStorage();
    expect(hasBeenWelcomed('u1', storage)).toBe(false);
  });

  it('returns true after markWelcomed', () => {
    const storage = makeFakeStorage();
    markWelcomed('u1', storage);
    expect(hasBeenWelcomed('u1', storage)).toBe(true);
  });

  it('is scoped per-user-id', () => {
    const storage = makeFakeStorage();
    markWelcomed('u1', storage);
    expect(hasBeenWelcomed('u2', storage)).toBe(false);
  });

  it('writes the value "true" to the storage', () => {
    const storage = makeFakeStorage();
    markWelcomed('u1', storage);
    expect(storage.data.get('welcomed_u1')).toBe('true');
  });
});

describe('hasBeenGreetedToday / markGreetedToday', () => {
  it('returns false when the key is absent', () => {
    const storage = makeFakeStorage();
    expect(hasBeenGreetedToday('u1', 'Wed May 07 2026', storage)).toBe(false);
  });

  it('returns true after markGreetedToday for the same date', () => {
    const storage = makeFakeStorage();
    markGreetedToday('u1', 'Wed May 07 2026', storage);
    expect(hasBeenGreetedToday('u1', 'Wed May 07 2026', storage)).toBe(true);
  });

  it('is scoped per-day (yesterday’s mark does not satisfy today)', () => {
    const storage = makeFakeStorage();
    markGreetedToday('u1', 'Tue May 06 2026', storage);
    expect(hasBeenGreetedToday('u1', 'Wed May 07 2026', storage)).toBe(false);
  });

  it('is scoped per-user', () => {
    const storage = makeFakeStorage();
    markGreetedToday('u1', 'Wed May 07 2026', storage);
    expect(hasBeenGreetedToday('u2', 'Wed May 07 2026', storage)).toBe(false);
  });
});

describe('todayDateString', () => {
  it('returns the same shape as Date.toDateString', () => {
    const now = new Date('2026-05-07T13:00:00Z');
    expect(todayDateString(now)).toBe(now.toDateString());
  });

  it('does not include the time-of-day, so two times on the same day produce the same key', () => {
    // Local-time constructor so the assertion is timezone-independent.
    const morning = new Date(2026, 4, 7, 9, 0);
    const evening = new Date(2026, 4, 7, 21, 0);
    expect(todayDateString(morning)).toBe(todayDateString(evening));
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
        hasBeenGreetedToday: false,
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
        hasBeenGreetedToday: false,
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
        hasBeenGreetedToday: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });
});

describe('decideFirstLoadActions — welcome redirect short-circuits greet', () => {
  it('first sign-in (no welcomed flag): emits redirect-welcome only', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: false,
        hasBeenGreetedToday: false,
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
        hasBeenGreetedToday: false,
        localNoteCount: 3,
      }),
    ).toEqual([{ kind: 'redirect-welcome' }, { kind: 'offer-migration' }]);
  });
});

describe('decideFirstLoadActions — returning user', () => {
  it('welcomed and not greeted today: emits greet with firstName', () => {
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
        hasBeenGreetedToday: false,
        localNoteCount: 0,
      }),
    ).toEqual([{ kind: 'greet', firstName: 'Grace' }]);
  });

  it('welcomed and already greeted today: emits no actions', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenGreetedToday: true,
        localNoteCount: 0,
      }),
    ).toEqual([]);
  });

  it('welcomed, not greeted, with local notes: emits greet AND offer-migration in order', () => {
    const user = makeUser({ id: 'u1', email: 'ada@ex.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenGreetedToday: false,
        localNoteCount: 1,
      }),
    ).toEqual([{ kind: 'greet', firstName: 'ada' }, { kind: 'offer-migration' }]);
  });

  it('welcomed, already greeted, with local notes: emits offer-migration only', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenGreetedToday: true,
        localNoteCount: 7,
      }),
    ).toEqual([{ kind: 'offer-migration' }]);
  });
});
