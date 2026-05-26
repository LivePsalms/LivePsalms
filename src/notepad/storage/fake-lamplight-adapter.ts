import type {
  LamplightAdapter,
  LamplightSettings,
  LamplightEntitlement,
  PromoConfig,
} from './lamplight-adapter';

/**
 * In-memory LamplightAdapter for unit tests. Mirrors the Supabase
 * behaviour for read/write/delete without going through Postgres.
 */
export class FakeLamplightAdapter implements LamplightAdapter {
  settings = new Map<string, LamplightSettings>();
  entitlements = new Map<string, LamplightEntitlement>();
  promo: PromoConfig = { promoActive: true, promoEndsAt: null };
  deleteAllUserDataCalls: string[] = [];
  // Track every enqueueEmbedding call for assertions.
  public enqueueCalls: Array<{ noteId: string; contentHash: string }> = [];
  // Map note_id → last accepted hash (returns null on duplicate).
  private enqueuedHash = new Map<string, string>();

  async getSettings(userId: string): Promise<LamplightSettings | null> {
    return this.settings.get(userId) ?? null;
  }

  async upsertSettings(
    userId: string,
    patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<LamplightSettings> {
    const now = new Date().toISOString();
    const existing = this.settings.get(userId);
    const merged: LamplightSettings = {
      enabled: false,
      quietMode: false,
      voicePreference: 'Lord',
      traditionHint: 'unspecified',
      inlineSuggestions: true,
      weeklyEmail: false,
      consentDecidedAt: null,
      createdAt: existing?.createdAt ?? now,
      ...existing,
      ...patch,
      userId,
      updatedAt: now,
    };
    this.settings.set(userId, merged);
    return { ...merged };
  }

  async enqueueEmbedding(noteId: string, contentHash: string): Promise<string | null> {
    this.enqueueCalls.push({ noteId, contentHash });
    if (this.enqueuedHash.get(noteId) === contentHash) return null;
    this.enqueuedHash.set(noteId, contentHash);
    return `job-${noteId}-${contentHash.slice(0, 8)}`;
  }

  async deleteAllUserData(userId: string): Promise<void> {
    this.deleteAllUserDataCalls.push(userId);
    this.settings.delete(userId);
    this.entitlements.delete(userId);
  }

  async getEntitlement(userId: string): Promise<LamplightEntitlement | null> {
    return this.entitlements.get(userId) ?? null;
  }

  async getPromoConfig(): Promise<PromoConfig> {
    return { ...this.promo };
  }
}
