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
} from './lamplight-adapter';

const LAMPLIGHT_USER_TABLES = [
  'lamplight_settings',
  'lamplight_entitlements',
  'lamplight_embeddings',
  'lamplight_artifacts',
  'lamplight_jobs',
  'lamplight_suggestions_log',
  'lamplight_connections',
] as const;

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

  async deleteAllUserData(userId: string): Promise<void> {
    for (const table of LAMPLIGHT_USER_TABLES) {
      const { error } = await this.#client.from(table).delete().eq('user_id', userId);
      if (error) throw error;
    }
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
