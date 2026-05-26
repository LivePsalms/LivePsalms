import { describe, it, expect, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseLamplightAdapter } from './supabase-lamplight-adapter';

interface SettingsRow {
  user_id: string;
  enabled: boolean;
  quiet_mode: boolean;
  voice_preference: string;
  tradition_hint: string;
  inline_suggestions: boolean;
  weekly_email: boolean;
  consent_decided_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EntitlementRow {
  user_id: string;
  tier: string;
  source: string | null;
  granted_at: string | null;
  expires_at: string | null;
}

interface ConfigRow {
  key: string;
  value: unknown;
}

interface Backend {
  settings: SettingsRow[];
  entitlements: EntitlementRow[];
  config: ConfigRow[];
  deletes: { table: string; userId: string }[];
}

function makeClient(backend: Backend): SupabaseClient {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq(_col: string, val: string) {
              return {
                async maybeSingle() {
                  if (table === 'lamplight_settings') {
                    return { data: backend.settings.find((r) => r.user_id === val) ?? null, error: null };
                  }
                  if (table === 'lamplight_entitlements') {
                    return { data: backend.entitlements.find((r) => r.user_id === val) ?? null, error: null };
                  }
                  if (table === 'app_config') {
                    return { data: backend.config.find((r) => r.key === val) ?? null, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
            in(_col: string, vals: string[]) {
              return {
                async then(resolve: (v: { data: unknown[]; error: null }) => void) {
                  if (table === 'app_config') {
                    resolve({ data: backend.config.filter((r) => vals.includes(r.key)), error: null });
                  }
                },
              };
            },
          };
        },
        upsert(payload: Record<string, unknown>) {
          return {
            select() {
              return {
                async single() {
                  if (table === 'lamplight_settings') {
                    const userId = payload.user_id as string;
                    const idx = backend.settings.findIndex((r) => r.user_id === userId);
                    const now = new Date().toISOString();
                    const existing = idx >= 0 ? backend.settings[idx] : null;
                    const row: SettingsRow = {
                      user_id: userId,
                      enabled: false,
                      quiet_mode: false,
                      voice_preference: 'Lord',
                      tradition_hint: 'unspecified',
                      inline_suggestions: true,
                      weekly_email: false,
                      consent_decided_at: null,
                      created_at: existing?.created_at ?? now,
                      updated_at: now,
                      ...(existing ?? {}),
                      ...payload,
                    } as SettingsRow;
                    if (idx >= 0) backend.settings[idx] = row;
                    else backend.settings.push(row);
                    return { data: row, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        delete() {
          return {
            async eq(_col: string, val: string) {
              backend.deletes.push({ table, userId: val });
              if (table === 'lamplight_settings') backend.settings = backend.settings.filter((r) => r.user_id !== val);
              if (table === 'lamplight_entitlements') backend.entitlements = backend.entitlements.filter((r) => r.user_id !== val);
              return { error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe('SupabaseLamplightAdapter — settings', () => {
  let backend: Backend;
  let adapter: SupabaseLamplightAdapter;

  beforeEach(() => {
    backend = { settings: [], entitlements: [], config: [], deletes: [] };
    adapter = new SupabaseLamplightAdapter(makeClient(backend));
  });

  it('returns null when no settings row exists for the user', async () => {
    expect(await adapter.getSettings('user-1')).toBeNull();
  });

  it('returns mapped settings when a row exists', async () => {
    backend.settings.push({
      user_id: 'user-1',
      enabled: true,
      quiet_mode: false,
      voice_preference: 'Father',
      tradition_hint: 'evangelical',
      inline_suggestions: true,
      weekly_email: false,
      consent_decided_at: '2026-05-25T00:00:00Z',
      created_at: '2026-05-25T00:00:00Z',
      updated_at: '2026-05-25T00:00:00Z',
    });
    const s = await adapter.getSettings('user-1');
    expect(s).toEqual({
      userId: 'user-1',
      enabled: true,
      quietMode: false,
      voicePreference: 'Father',
      traditionHint: 'evangelical',
      inlineSuggestions: true,
      weeklyEmail: false,
      consentDecidedAt: '2026-05-25T00:00:00Z',
      createdAt: '2026-05-25T00:00:00Z',
      updatedAt: '2026-05-25T00:00:00Z',
    });
  });

  it('upserts settings with defaults on first write', async () => {
    const s = await adapter.upsertSettings('user-1', {
      enabled: true,
      voicePreference: 'Abba',
      consentDecidedAt: '2026-05-25T00:00:00Z',
    });
    expect(s.userId).toBe('user-1');
    expect(s.enabled).toBe(true);
    expect(s.voicePreference).toBe('Abba');
    expect(s.traditionHint).toBe('unspecified');
    expect(s.consentDecidedAt).toBe('2026-05-25T00:00:00Z');
    expect(backend.settings).toHaveLength(1);
  });

  it('deletes settings + entitlements rows for the user via deleteAllUserData', async () => {
    backend.settings.push({
      user_id: 'user-1', enabled: true, quiet_mode: false,
      voice_preference: 'Lord', tradition_hint: 'unspecified',
      inline_suggestions: true, weekly_email: false,
      consent_decided_at: null,
      created_at: '2026-05-25T00:00:00Z', updated_at: '2026-05-25T00:00:00Z',
    });
    backend.entitlements.push({
      user_id: 'user-1', tier: 'plus', source: 'grant',
      granted_at: '2026-05-25T00:00:00Z', expires_at: null,
    });
    await adapter.deleteAllUserData('user-1');
    expect(backend.settings).toHaveLength(0);
    expect(backend.entitlements).toHaveLength(0);
    const deletedTables = backend.deletes.map((d) => d.table).sort();
    expect(deletedTables).toEqual([
      'lamplight_artifacts',
      'lamplight_connections',
      'lamplight_embeddings',
      'lamplight_entitlements',
      'lamplight_jobs',
      'lamplight_settings',
      'lamplight_suggestions_log',
    ]);
  });
});

describe('SupabaseLamplightAdapter — entitlement + promo', () => {
  let backend: Backend;
  let adapter: SupabaseLamplightAdapter;

  beforeEach(() => {
    backend = { settings: [], entitlements: [], config: [], deletes: [] };
    adapter = new SupabaseLamplightAdapter(makeClient(backend));
  });

  it('returns null when no entitlement row exists', async () => {
    expect(await adapter.getEntitlement('user-1')).toBeNull();
  });

  it('returns mapped entitlement when a row exists', async () => {
    backend.entitlements.push({
      user_id: 'user-1', tier: 'plus', source: 'grant',
      granted_at: '2026-05-25T00:00:00Z', expires_at: null,
    });
    const e = await adapter.getEntitlement('user-1');
    expect(e).toEqual({
      userId: 'user-1',
      tier: 'plus',
      source: 'grant',
      grantedAt: '2026-05-25T00:00:00Z',
      expiresAt: null,
    });
  });

  it('returns { promoActive: false, promoEndsAt: null } when config rows are absent', async () => {
    expect(await adapter.getPromoConfig()).toEqual({ promoActive: false, promoEndsAt: null });
  });

  it('returns promo config values from app_config', async () => {
    backend.config.push({ key: 'lamplight_promo_active', value: true });
    backend.config.push({ key: 'lamplight_promo_ends_at', value: null });
    expect(await adapter.getPromoConfig()).toEqual({ promoActive: true, promoEndsAt: null });
  });

  it('does NOT treat JSON string "false" as promoActive=true', async () => {
    backend.config.push({ key: 'lamplight_promo_active', value: 'false' });
    expect(await adapter.getPromoConfig()).toEqual({ promoActive: false, promoEndsAt: null });
  });
});
