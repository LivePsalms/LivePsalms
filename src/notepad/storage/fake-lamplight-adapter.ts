import type {
  LamplightAdapter,
  LamplightSettings,
  LamplightEntitlement,
  PromoConfig,
  DailyDevotionGenerateResult,
  ConnectionNeighbor,
  ConnectionWhyResult,
} from './lamplight-adapter';
import type { DailyDevotion } from './lamplight-artifacts';

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
  // Daily devotion store: key = `${userId}:${periodKey}`.
  dailyDevotions = new Map<string, DailyDevotion>();

  __seedDailyDevotion(userId: string, periodKey: string, artifact: DailyDevotion): void {
    this.dailyDevotions.set(`${userId}:${periodKey}`, artifact);
  }

  async getDailyDevotion(userId: string, periodKey: string): Promise<DailyDevotion | null> {
    return this.dailyDevotions.get(`${userId}:${periodKey}`) ?? null;
  }

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
    for (const key of [...this.dailyDevotions.keys()]) {
      if (key.startsWith(`${userId}:`)) this.dailyDevotions.delete(key);
    }
  }

  async getEntitlement(userId: string): Promise<LamplightEntitlement | null> {
    return this.entitlements.get(userId) ?? null;
  }

  private queuedGenerateResults: DailyDevotionGenerateResult[] = [];

  __queueGenerateResult(result: DailyDevotionGenerateResult): void {
    this.queuedGenerateResults.push(result);
  }

  async generateDailyDevotion(userId: string, localDate: string): Promise<DailyDevotionGenerateResult> {
    const next = this.queuedGenerateResults.shift();
    if (!next) return { ok: false, reason: 'network' };
    if (next.ok) {
      this.dailyDevotions.set(`${userId}:${localDate}`, next.artifact);
    }
    return next;
  }

  async getPromoConfig(): Promise<PromoConfig> {
    return { ...this.promo };
  }

  // ── Connection Cards ────────────────────────────────────────────────
  private connectionNeighbors = new Map<string, ConnectionNeighbor[]>();
  private noteEmbeddingsPresent = new Set<string>();
  // Key format: `${sourceNoteId}::${relatedNoteId}`
  private connectionWhyCache = new Map<string, string>();
  private nextGenerateConnectionWhyFailure:
    | 'no_embedding'
    | 'validators_failed'
    | 'not_neighbor'
    | 'network'
    | null = null;

  __seedConnectionNeighbors(sourceNoteId: string, neighbors: ConnectionNeighbor[]): void {
    this.connectionNeighbors.set(sourceNoteId, neighbors);
  }

  __seedNoteEmbedding(noteId: string): void {
    this.noteEmbeddingsPresent.add(noteId);
  }

  __seedConnectionWhy(sourceNoteId: string, relatedNoteId: string, why: string): void {
    this.connectionWhyCache.set(`${sourceNoteId}::${relatedNoteId}`, why);
  }

  __failNextGenerateConnectionWhy(
    reason: 'no_embedding' | 'validators_failed' | 'not_neighbor' | 'network',
  ): void {
    this.nextGenerateConnectionWhyFailure = reason;
  }

  async getConnectionNeighbors(
    sourceNoteId: string,
    _k = 5,
  ): Promise<ConnectionNeighbor[]> {
    return this.connectionNeighbors.get(sourceNoteId) ?? [];
  }

  async hasNoteEmbedding(noteId: string): Promise<boolean> {
    return this.noteEmbeddingsPresent.has(noteId);
  }

  async generateConnectionWhy(
    sourceNoteId: string,
    relatedNoteId: string,
  ): Promise<ConnectionWhyResult> {
    if (this.nextGenerateConnectionWhyFailure) {
      const reason = this.nextGenerateConnectionWhyFailure;
      this.nextGenerateConnectionWhyFailure = null;
      return { ok: false, reason };
    }
    const key = `${sourceNoteId}::${relatedNoteId}`;
    const cached = this.connectionWhyCache.get(key);
    if (cached) {
      return { ok: true, why: cached, cached: true };
    }
    const why = `Fake connection between ${sourceNoteId} and ${relatedNoteId}.`;
    this.connectionWhyCache.set(key, why);
    return { ok: true, why, cached: false };
  }
}
