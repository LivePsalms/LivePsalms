import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  subscribe,
  type NewsletterClient,
  type NewsletterInsertResult,
} from './newsletter-actions';

describe('isValidEmail', () => {
  it('returns true for a normal address', () => {
    expect(isValidEmail('hello@example.com')).toBe(true);
  });

  it('returns true for an address with a subdomain', () => {
    expect(isValidEmail('user.name@mail.example.co')).toBe(true);
  });

  it('returns true after trimming surrounding whitespace', () => {
    expect(isValidEmail('  hello@example.com  ')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('returns false for whitespace-only input', () => {
    expect(isValidEmail('   ')).toBe(false);
  });

  it('returns false for a bare word', () => {
    expect(isValidEmail('foo')).toBe(false);
  });

  it('returns false when the local part is missing', () => {
    expect(isValidEmail('@bar.com')).toBe(false);
  });

  it('returns false when the @ is missing', () => {
    expect(isValidEmail('foobar.com')).toBe(false);
  });

  it('returns false when the TLD is missing', () => {
    expect(isValidEmail('foo@bar')).toBe(false);
  });
});

function makeFakeClient(result: NewsletterInsertResult): {
  client: NewsletterClient;
  inserts: Array<{ table: string; row: Record<string, unknown> }>;
} {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client: NewsletterClient = {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return result;
      },
    }),
  };
  return { client, inserts };
}

describe('subscribe', () => {
  it('returns success when the client resolves with no error', async () => {
    const { client, inserts } = makeFakeClient({ error: null });
    const result = await subscribe({
      email: 'hello@example.com',
      source: 'home-final-cta',
      client,
    });
    expect(result).toEqual({ kind: 'success', alreadySubscribed: false });
    expect(inserts).toEqual([
      {
        table: 'newsletter_subscribers',
        row: { email: 'hello@example.com', source: 'home-final-cta' },
      },
    ]);
  });

  it('trims whitespace before inserting', async () => {
    const { client, inserts } = makeFakeClient({ error: null });
    await subscribe({
      email: '  hello@example.com  ',
      source: 'home-final-cta',
      client,
    });
    expect(inserts[0]?.row.email).toBe('hello@example.com');
  });

  it('returns invalid-email when the email fails validation', async () => {
    const { client } = makeFakeClient({ error: null });
    const result = await subscribe({
      email: 'not-an-email',
      source: 'home-final-cta',
      client,
    });
    expect(result).toEqual({ kind: 'invalid-email' });
  });

  it('returns no-client when client is null', async () => {
    const result = await subscribe({
      email: 'hello@example.com',
      source: 'home-final-cta',
      client: null,
    });
    expect(result).toEqual({ kind: 'no-client' });
  });

  it('maps Postgres unique-violation 23505 to alreadySubscribed: true', async () => {
    const { client } = makeFakeClient({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    const result = await subscribe({
      email: 'hello@example.com',
      source: 'home-final-cta',
      client,
    });
    expect(result).toEqual({ kind: 'success', alreadySubscribed: true });
  });

  it('returns network-error for any other Supabase error', async () => {
    const { client } = makeFakeClient({
      error: { code: '08000', message: 'connection exception' },
    });
    const result = await subscribe({
      email: 'hello@example.com',
      source: 'home-final-cta',
      client,
    });
    expect(result).toEqual({ kind: 'network-error' });
  });

  it('returns network-error when the client throws', async () => {
    const client: NewsletterClient = {
      from: () => ({
        insert: async () => {
          throw new Error('network down');
        },
      }),
    };
    const result = await subscribe({
      email: 'hello@example.com',
      source: 'home-final-cta',
      client,
    });
    expect(result).toEqual({ kind: 'network-error' });
  });
});
