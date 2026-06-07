import { describe, it, expect } from 'vitest';
import { FakeLamplightAdapter } from './fake-lamplight-adapter';

describe('FakeLamplightAdapter.generatePrettifyPlan', () => {
  it('short-circuits empty content to no_content without consuming a queued result', async () => {
    const a = new FakeLamplightAdapter();
    a.__queuePrettifyResult({ ok: true, plan: { summary: '', highlights: [], decorations: [], connections: [] } });
    const r = await a.generatePrettifyPlan('u1', 'n1', '   ', 'balanced');
    expect(r).toEqual({ ok: false, reason: 'no_content' });
    // queued result still available for the next non-empty call
    const r2 = await a.generatePrettifyPlan('u1', 'n1', 'real text', 'balanced');
    expect(r2.ok).toBe(true);
  });

  it('returns the queued result for non-empty content', async () => {
    const a = new FakeLamplightAdapter();
    a.__queuePrettifyResult({ ok: false, reason: 'quota' });
    const r = await a.generatePrettifyPlan('u1', 'n1', 'text', 'light');
    expect(r).toEqual({ ok: false, reason: 'quota' });
  });

  it('defaults to network when the queue is empty', async () => {
    const a = new FakeLamplightAdapter();
    const r = await a.generatePrettifyPlan('u1', 'n1', 'text', 'rich');
    expect(r).toEqual({ ok: false, reason: 'network' });
  });
});
