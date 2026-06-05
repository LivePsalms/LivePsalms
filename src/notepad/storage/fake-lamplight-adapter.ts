import type {
  LamplightAdapter,
  LamplightSettings,
  LamplightEntitlement,
  PromoConfig,
  DailyDevotionGenerateResult,
  ConnectionNeighbor,
  ConnectionWhyResult,
  ConnectionCardThresholds,
  AdminJobFilters,
  AdminJobRow,
  AdminJobCounts,
  AdminUsageRow,
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
  connectionCardThresholds: ConnectionCardThresholds = { minSimilarity: 0.78 };
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

  async getConnectionCardThresholds(): Promise<ConnectionCardThresholds> {
    return { ...this.connectionCardThresholds };
  }

  // Admin fake state.
  public isAdmin = false;
  public usageRows: Array<{
    userId: string;
    model: string;
    artifactKind: string;
    tokensIn: number;
    tokensOut: number;
    status: 'ok' | 'error';
    errorCode?: string | null;
    createdAt: string;
  }> = [];
  public adminJobs: AdminJobRow[] = [];

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
  private failNextGetConnectionNeighbors = false;

  __failNextGetConnectionNeighbors(): void {
    this.failNextGetConnectionNeighbors = true;
  }

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
    k = 5,
    minSimilarity?: number,
  ): Promise<ConnectionNeighbor[]> {
    if (this.failNextGetConnectionNeighbors) {
      this.failNextGetConnectionNeighbors = false;
      throw new Error('simulated network failure');
    }
    const all = this.connectionNeighbors.get(sourceNoteId) ?? [];
    const filtered =
      typeof minSimilarity === 'number'
        ? all.filter((n) => n.similarity >= minSimilarity)
        : all;
    return filtered.slice(0, k);
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

  async isLamplightAdmin(): Promise<boolean> {
    return this.isAdmin;
  }

  async adminListJobs(filters: AdminJobFilters): Promise<AdminJobRow[]> {
    const status = filters.status ?? ['failed'];
    const since = filters.since ? new Date(filters.since).getTime() : 0;
    return this.adminJobs.filter((j) => {
      if (!status.includes(j.status)) return false;
      if (filters.kind && !filters.kind.includes(j.kind)) return false;
      if (filters.userSearch) {
        const q = filters.userSearch.toLowerCase();
        const matchEmail = (j.email ?? '').toLowerCase().includes(q);
        const matchId = j.userId === filters.userSearch;
        if (!matchEmail && !matchId) return false;
      }
      if (since && new Date(j.scheduledAt).getTime() < since) return false;
      return true;
    }).slice(0, filters.limit ?? 200);
  }

  async adminJobCounts(sinceIso: string): Promise<AdminJobCounts> {
    const sinceMs = new Date(sinceIso).getTime();
    const inWindow = this.adminJobs.filter(j => new Date(j.scheduledAt).getTime() >= sinceMs);
    const by = (s: AdminJobRow['status']) => inWindow.filter(j => j.status === s).length;
    return {
      queued: by('queued'),
      running: by('running'),
      done: by('done'),
      failed: by('failed'),
      since: sinceIso,
    };
  }

  async adminRequeueJob(jobId: string): Promise<AdminJobRow> {
    const idx = this.adminJobs.findIndex(j => j.id === jobId);
    if (idx < 0) throw new Error(`job not found: ${jobId}`);
    const next: AdminJobRow = {
      ...this.adminJobs[idx],
      status: 'queued',
      attempts: 0,
      error: null,
      scheduledAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    };
    this.adminJobs[idx] = next;
    return next;
  }

  async adminRequeueAllFailed(kind?: string, limit?: number): Promise<number> {
    const cap = Math.min(Math.max(1, limit ?? 100), 100);
    const candidates = this.adminJobs
      .filter(j => j.status === 'failed' && (!kind || j.kind === kind))
      .slice(0, cap);
    candidates.forEach((j) => {
      const i = this.adminJobs.findIndex(x => x.id === j.id);
      this.adminJobs[i] = {
        ...j,
        status: 'queued',
        attempts: 0,
        error: null,
        scheduledAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      };
    });
    return candidates.length;
  }

  async adminUsageTop(windowDays: number, limit?: number): Promise<AdminUsageRow[]> {
    const cutoff = Date.now() - Math.max(1, windowDays) * 24 * 3600 * 1000;
    const byUser = new Map<string, { tokensIn: number; tokensOut: number; calls: number; errors: number }>();
    for (const row of this.usageRows) {
      if (new Date(row.createdAt).getTime() < cutoff) continue;
      const cur = byUser.get(row.userId) ?? { tokensIn: 0, tokensOut: 0, calls: 0, errors: 0 };
      cur.tokensIn += row.tokensIn;
      cur.tokensOut += row.tokensOut;
      cur.calls += 1;
      if (row.status === 'error') cur.errors += 1;
      byUser.set(row.userId, cur);
    }
    return Array.from(byUser.entries())
      .map(([userId, agg]) => ({ userId, email: null, ...agg }))
      .sort((a, b) => (b.tokensIn + b.tokensOut) - (a.tokensIn + a.tokensOut))
      .slice(0, limit ?? 50);
  }
}
