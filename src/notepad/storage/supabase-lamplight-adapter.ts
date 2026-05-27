import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LamplightAdapter,
  LamplightSettings,
  LamplightEntitlement,
  PromoConfig,
  LamplightVoice,
  LamplightTradition,
  LamplightTier,
  LamplightEntitlementSource,
  DailyDevotionGenerateResult,
  ConnectionNeighbor,
  ConnectionWhyResult,
} from './lamplight-adapter';
import type { DailyDevotion } from './lamplight-artifacts';

// Tables with a `user_id` column — deletable via `eq('user_id', userId)`.
const LAMPLIGHT_USER_ID_TABLES = [
  'lamplight_settings',
  'lamplight_entitlements',
  'lamplight_embeddings',
  'lamplight_artifacts',
  'lamplight_jobs',
  'lamplight_suggestions_log',
] as const;

// `lamplight_connections` has no `user_id` column — it's scoped to a user via
// EXISTS-against-notes in its RLS policy. The deleteAllUserData flow uses a
// tautology predicate (`note_id IS NOT NULL`) to satisfy Supabase JS's
// "delete needs a filter" guard; RLS itself does the user scoping.
const LAMPLIGHT_CONNECTIONS_TABLE = 'lamplight_connections';

export class SupabaseLamplightAdapter implements LamplightAdapter {
  #client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.#client = client;
  }

  async getSettings(userId: string): Promise<LamplightSettings | null> {
    const { data, error } = await this.#client
      .from('lamplight_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? this.#mapSettings(data) : null;
  }

  async upsertSettings(
    userId: string,
    patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<LamplightSettings> {
    const payload: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
    if (patch.enabled !== undefined) payload.enabled = patch.enabled;
    if (patch.quietMode !== undefined) payload.quiet_mode = patch.quietMode;
    if (patch.voicePreference !== undefined) payload.voice_preference = patch.voicePreference;
    if (patch.traditionHint !== undefined) payload.tradition_hint = patch.traditionHint;
    if (patch.inlineSuggestions !== undefined) payload.inline_suggestions = patch.inlineSuggestions;
    if (patch.weeklyEmail !== undefined) payload.weekly_email = patch.weeklyEmail;
    if (patch.consentDecidedAt !== undefined) payload.consent_decided_at = patch.consentDecidedAt;

    const { data, error } = await this.#client
      .from('lamplight_settings')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return this.#mapSettings(data);
  }

  async enqueueEmbedding(noteId: string, contentHash: string): Promise<string | null> {
    const { data, error } = await this.#client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteId,
      p_content_hash: contentHash,
    });
    if (error) throw error;
    return (data as string | null) ?? null;
  }

  async deleteAllUserData(userId: string): Promise<void> {
    for (const table of LAMPLIGHT_USER_ID_TABLES) {
      const { error } = await this.#client.from(table).delete().eq('user_id', userId);
      if (error) throw error;
    }
    // lamplight_connections has no user_id column. RLS filters to the current
    // user's notes; the tautology predicate just satisfies Supabase JS's
    // "delete requires a filter" safety guard.
    const { error } = await this.#client
      .from(LAMPLIGHT_CONNECTIONS_TABLE)
      .delete()
      .not('note_id', 'is', null);
    if (error) throw error;
  }

  async getEntitlement(userId: string): Promise<LamplightEntitlement | null> {
    const { data, error } = await this.#client
      .from('lamplight_entitlements')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? this.#mapEntitlement(data) : null;
  }

  async getDailyDevotion(userId: string, periodKey: string): Promise<DailyDevotion | null> {
    const { data, error } = await this.#client
      .from('lamplight_artifacts')
      .select('body')
      .eq('user_id', userId)
      .eq('type', 'daily_devotion')
      .eq('period_key', periodKey)
      .maybeSingle();
    if (error) throw error;
    return data ? (data.body as DailyDevotion) : null;
  }

  async generateDailyDevotion(userId: string, localDate: string): Promise<DailyDevotionGenerateResult> {
    try {
      const { data, error } = await this.#client.functions.invoke('lamplight-generate', {
        body: { kind: 'daily_devotion', user_id: userId, local_date: localDate },
      });
      if (error) return { ok: false, reason: 'network' };
      if (!data || typeof data !== 'object') return { ok: false, reason: 'network' };
      const d = data as { ok?: boolean; artifact?: DailyDevotion; cached?: boolean; reason?: string };
      if (d.ok === true && d.artifact) {
        return { ok: true, artifact: d.artifact, cached: !!d.cached };
      }
      if (d.ok === false && (d.reason === 'no_notes' || d.reason === 'validators_failed')) {
        return { ok: false, reason: d.reason };
      }
      return { ok: false, reason: 'network' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  async getConnectionNeighbors(
    sourceNoteId: string,
    k = 5,
  ): Promise<ConnectionNeighbor[]> {
    const { data, error } = await this.#client.rpc('match_my_note_neighbors', {
      p_source_note_id: sourceNoteId,
      p_k: k,
    });
    if (error) throw error;
    return ((data as Array<{ related_note_id: string; similarity: number }>) ?? []).map(
      (row) => ({
        relatedNoteId: row.related_note_id,
        similarity: row.similarity,
      }),
    );
  }

  async hasNoteEmbedding(noteId: string): Promise<boolean> {
    const { count, error } = await this.#client
      .from('lamplight_embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('source_type', 'note')
      .eq('source_id', noteId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async generateConnectionWhy(
    sourceNoteId: string,
    relatedNoteId: string,
  ): Promise<ConnectionWhyResult> {
    try {
      const { data: userResp } = await this.#client.auth.getUser();
      const user = userResp?.user;
      if (!user) return { ok: false, reason: 'network' };
      const { data, error } = await this.#client.functions.invoke('lamplight-generate', {
        body: {
          kind: 'connection_card_why',
          user_id: user.id,
          source_note_id: sourceNoteId,
          related_note_id: relatedNoteId,
        },
      });
      if (error) return { ok: false, reason: 'network' };
      if (!data || typeof data !== 'object') return { ok: false, reason: 'network' };
      const d = data as Record<string, unknown>;
      if (d.ok === true && typeof d.why === 'string') {
        return { ok: true, why: d.why, cached: !!d.cached };
      }
      if (
        d.ok === false &&
        (d.reason === 'no_embedding' ||
          d.reason === 'validators_failed' ||
          d.reason === 'not_neighbor')
      ) {
        return {
          ok: false,
          reason: d.reason as 'no_embedding' | 'validators_failed' | 'not_neighbor',
        };
      }
      return { ok: false, reason: 'network' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  async getPromoConfig(): Promise<PromoConfig> {
    const { data, error } = await this.#client
      .from('app_config')
      .select('key,value')
      .in('key', ['lamplight_promo_active', 'lamplight_promo_ends_at']);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ key: string; value: unknown }>;
    const promoRow = rows.find((r) => r.key === 'lamplight_promo_active');
    const endsRow = rows.find((r) => r.key === 'lamplight_promo_ends_at');
    return {
      promoActive: promoRow?.value === true,
      promoEndsAt: typeof endsRow?.value === 'string' ? endsRow.value : null,
    };
  }

  #mapSettings(row: Record<string, unknown>): LamplightSettings {
    return {
      userId: row.user_id as string,
      enabled: row.enabled as boolean,
      quietMode: row.quiet_mode as boolean,
      voicePreference: row.voice_preference as LamplightVoice,
      traditionHint: row.tradition_hint as LamplightTradition,
      inlineSuggestions: row.inline_suggestions as boolean,
      weeklyEmail: row.weekly_email as boolean,
      consentDecidedAt: (row.consent_decided_at as string) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  #mapEntitlement(row: Record<string, unknown>): LamplightEntitlement {
    return {
      userId: row.user_id as string,
      tier: row.tier as LamplightTier,
      source: (row.source as LamplightEntitlementSource) ?? null,
      grantedAt: (row.granted_at as string) ?? null,
      expiresAt: (row.expires_at as string) ?? null,
    };
  }
}
