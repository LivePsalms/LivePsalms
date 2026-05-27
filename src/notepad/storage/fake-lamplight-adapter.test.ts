import { describe, it, expect, beforeEach } from 'vitest';
import { FakeLamplightAdapter } from './fake-lamplight-adapter';

describe('FakeLamplightAdapter.enqueueEmbedding', () => {
  let a: FakeLamplightAdapter;
  beforeEach(() => { a = new FakeLamplightAdapter(); });

  it('returns a job id on first enqueue', async () => {
    const id = await a.enqueueEmbedding('n1', 'h1');
    expect(id).toBe('job-n1-h1');
    expect(a.enqueueCalls).toEqual([{ noteId: 'n1', contentHash: 'h1' }]);
  });

  it('returns null when the same hash is enqueued twice', async () => {
    await a.enqueueEmbedding('n1', 'h1');
    const second = await a.enqueueEmbedding('n1', 'h1');
    expect(second).toBeNull();
    expect(a.enqueueCalls.length).toBe(2);
  });

  it('returns a new job id when hash changes', async () => {
    const a1 = await a.enqueueEmbedding('n1', 'h1');
    const a2 = await a.enqueueEmbedding('n1', 'h2');
    expect(a1).not.toBe(a2);
    expect(a2).toBe('job-n1-h2');
  });
});

import type { DailyDevotion } from './lamplight-artifacts';

describe('FakeLamplightAdapter.getDailyDevotion', () => {
  const devotion: DailyDevotion = {
    opening: 'opening',
    scripture: { ref: 'Psalm 23:4', text: 't' },
    reflection: 'r',
    prompt: 'p',
    note_citations: [{ note_id: 'n1', reason: 'rest' }],
  };

  it('returns null when nothing is seeded', async () => {
    const fake = new FakeLamplightAdapter();
    expect(await fake.getDailyDevotion('user-1', '2026-05-27')).toBeNull();
  });

  it('returns the seeded artifact for matching (userId, periodKey)', async () => {
    const fake = new FakeLamplightAdapter();
    fake.__seedDailyDevotion('user-1', '2026-05-27', devotion);
    expect(await fake.getDailyDevotion('user-1', '2026-05-27')).toEqual(devotion);
    expect(await fake.getDailyDevotion('user-2', '2026-05-27')).toBeNull();
    expect(await fake.getDailyDevotion('user-1', '2026-05-28')).toBeNull();
  });

  it('deleteAllUserData clears that user\'s daily devotions only', async () => {
    const fake = new FakeLamplightAdapter();
    fake.__seedDailyDevotion('user-1', '2026-05-27', devotion);
    fake.__seedDailyDevotion('user-2', '2026-05-27', devotion);
    await fake.deleteAllUserData('user-1');
    expect(await fake.getDailyDevotion('user-1', '2026-05-27')).toBeNull();
    expect(await fake.getDailyDevotion('user-2', '2026-05-27')).toEqual(devotion);
  });
});

describe('FakeLamplightAdapter.generateDailyDevotion', () => {
  const devotion: DailyDevotion = {
    opening: 'op', scripture: { ref: 'Psalm 23:4', text: 't' },
    reflection: 'r', prompt: 'p',
    note_citations: [{ note_id: 'n1', reason: 'rest' }],
  };

  it('returns the next queued result and persists artifact to the read store on success', async () => {
    const fake = new FakeLamplightAdapter();
    fake.__queueGenerateResult({ ok: true, artifact: devotion, cached: false });
    const result = await fake.generateDailyDevotion('user-1', '2026-05-27');
    expect(result).toEqual({ ok: true, artifact: devotion, cached: false });
    expect(await fake.getDailyDevotion('user-1', '2026-05-27')).toEqual(devotion);
  });

  it('returns the queued failure result without persisting', async () => {
    const fake = new FakeLamplightAdapter();
    fake.__queueGenerateResult({ ok: false, reason: 'no_notes' });
    const result = await fake.generateDailyDevotion('user-1', '2026-05-27');
    expect(result).toEqual({ ok: false, reason: 'no_notes' });
    expect(await fake.getDailyDevotion('user-1', '2026-05-27')).toBeNull();
  });

  it('defaults to network failure when no result is queued', async () => {
    const fake = new FakeLamplightAdapter();
    const result = await fake.generateDailyDevotion('user-1', '2026-05-27');
    expect(result).toEqual({ ok: false, reason: 'network' });
  });
});
