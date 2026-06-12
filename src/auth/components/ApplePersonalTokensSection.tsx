// src/auth/components/ApplePersonalTokensSection.tsx
import { useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createToken, listTokens, revokeToken, type PersonalToken,
} from '../personal-tokens';

const IMPORT_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/import-apple-note`;

export interface ApplePersonalTokensSectionProps {
  client: SupabaseClient;
  userId: string;
}

export function ApplePersonalTokensSection({ client, userId }: ApplePersonalTokensSectionProps) {
  const [list, setList] = useState<PersonalToken[]>([]);
  const [raw, setRaw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setList(await listTokens(client)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load tokens'); }
  }, [client]);

  useEffect(() => { void refresh(); }, [refresh]);

  const onGenerate = async () => {
    setBusy(true); setError(null);
    try {
      const token = await createToken(client, userId, 'Apple Notes Shortcut');
      setRaw(token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create token');
    } finally { setBusy(false); }
  };

  const onRevoke = async (id: string) => {
    setBusy(true); setError(null);
    try { await revokeToken(client, id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to revoke token'); }
    finally { setBusy(false); }
  };

  return (
    <section
      aria-labelledby="apple-notes-heading"
      className="px-6 py-6 rounded-xl"
      style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)' }}
    >
      <h3
        id="apple-notes-heading"
        className="text-sm mb-2"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        Connect Apple Notes
      </h3>
      <p
        className="text-xs mb-3"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Generate a token, then install the Apple Notes import Shortcut and paste the
        token plus this endpoint into it:
      </p>
      <code
        className="block text-xs mb-4 break-all px-3 py-2 rounded-lg"
        style={{
          background: 'var(--pale-stone)',
          color: 'var(--deep-umber)',
          fontFamily: 'monospace',
        }}
      >
        {IMPORT_ENDPOINT}
      </code>

      <button
        type="button"
        onClick={() => void onGenerate()}
        disabled={busy}
        className="text-xs px-3 py-2 rounded-lg mb-2 disabled:opacity-50"
        style={{
          background: 'var(--deep-umber)',
          color: 'var(--alabaster)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        Generate token
      </button>

      {raw && (
        <div
          role="status"
          className="mb-4 px-3 py-3 rounded-lg"
          style={{ background: 'var(--pale-stone)' }}
        >
          <p
            className="text-xs mb-2"
            style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            <strong>Copy this token now &mdash; you won&rsquo;t see it again.</strong>
          </p>
          <code
            className="block text-xs break-all mb-2"
            style={{ color: 'var(--deep-umber)', fontFamily: 'monospace' }}
          >
            {raw}
          </code>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(raw)}
            className="text-xs underline"
            style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            Copy
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="text-xs mb-3"
          style={{ color: '#b04040', fontFamily: 'Outfit, sans-serif' }}
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {list.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 text-xs"
            style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            <span>{t.name}</span>
            <span style={{ color: 'var(--silica)' }}>
              {t.lastUsedAt
                ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                : 'never used'}
            </span>
            <button
              type="button"
              onClick={() => void onRevoke(t.id)}
              disabled={busy}
              className="underline disabled:opacity-50"
              style={{ color: '#b04040' }}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
