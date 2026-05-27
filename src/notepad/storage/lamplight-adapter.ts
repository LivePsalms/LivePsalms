// Lamplight adapter contract. Implementations live in
// supabase-lamplight-adapter.ts (production) and fake-lamplight-adapter.ts
// (tests). This file is intentionally narrow — sub-projects 2-5 will extend
// it; keep it free of implementation to minimise merge churn.

export type LamplightVoice = 'Lord' | 'Father' | 'Abba' | 'Jesus';
export type LamplightTradition =
  | 'evangelical'
  | 'catholic'
  | 'orthodox'
  | 'unspecified';
export type LamplightTier = 'plus' | 'lite' | 'none';
export type LamplightEntitlementSource =
  | 'promo'
  | 'subscription'
  | 'grant';

export interface LamplightSettings {
  userId: string;
  enabled: boolean;
  quietMode: boolean;
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
  inlineSuggestions: boolean;
  weeklyEmail: boolean;
  consentDecidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LamplightEntitlement {
  userId: string;
  tier: LamplightTier;
  source: LamplightEntitlementSource | null;
  grantedAt: string | null;
  expiresAt: string | null;
}

export interface PromoConfig {
  promoActive: boolean;
  promoEndsAt: string | null;
}

import type { DailyDevotion } from './lamplight-artifacts';

export type DailyDevotionGenerateResult =
  | { ok: true; artifact: DailyDevotion; cached: boolean }
  | { ok: false; reason: 'no_notes' | 'validators_failed' | 'network' };

export interface ConnectionNeighbor {
  relatedNoteId: string;
  similarity: number;
}

export type ConnectionWhyResult =
  | { ok: true; why: string; cached: boolean }
  | { ok: false; reason: 'no_embedding' | 'validators_failed' | 'not_neighbor' | 'network' };

export interface LamplightAdapter {
  getSettings(userId: string): Promise<LamplightSettings | null>;
  upsertSettings(
    userId: string,
    patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<LamplightSettings>;
  deleteAllUserData(userId: string): Promise<void>;
  /**
   * Enqueue an embedding refresh for the given note. Calls the
   * `enqueue_lamplight_embedding` RPC, which is a no-op (returns null) when:
   *   - the user is opted out (`lamplight_settings.enabled = false`)
   *   - the supplied `contentHash` matches the existing embedding's hash
   *   - a queued job for the same note already exists (returns its id)
   * Returns the job id, or null when the RPC was a no-op.
   */
  enqueueEmbedding(noteId: string, contentHash: string): Promise<string | null>;
  getEntitlement(userId: string): Promise<LamplightEntitlement | null>;
  getPromoConfig(): Promise<PromoConfig>;
  /** Returns the persisted daily devotion for (userId, periodKey) if it exists, else null. */
  getDailyDevotion(userId: string, periodKey: string): Promise<DailyDevotion | null>;
  /** Invokes lamplight-generate Edge Function with kind='daily_devotion'. */
  generateDailyDevotion(userId: string, localDate: string): Promise<DailyDevotionGenerateResult>;
  /** Returns neighboring notes with similarity scores using the `match_my_note_neighbors` RPC. */
  getConnectionNeighbors(sourceNoteId: string, k?: number): Promise<ConnectionNeighbor[]>;
  /** Returns true if the given note has an embedding. */
  hasNoteEmbedding(noteId: string): Promise<boolean>;
  /** Invokes lamplight-generate Edge Function with kind='connection_card_why'. */
  generateConnectionWhy(sourceNoteId: string, relatedNoteId: string): Promise<ConnectionWhyResult>;
}
