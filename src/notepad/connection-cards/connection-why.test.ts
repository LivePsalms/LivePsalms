import { describe, it, expect } from 'vitest';
import { ConnectionWhy } from './connection-why';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function controllerFor(adapter: FakeLamplightAdapter) {
  return new ConnectionWhy(
    { generateConnectionWhy: (src, rel) => adapter.generateConnectionWhy(src, rel) },
    'note-1',
  );
}

describe('ConnectionWhy', () => {
  it('defaults each card to collapsed', () => {
    const c = controllerFor(new FakeLamplightAdapter());
    expect(c.whyState('note-2')).toEqual({ phase: 'collapsed' });
  });

  it('expand resolves to shown with cached flag', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedConnectionWhy('note-1', 'note-2', 'Both circle the same wilderness motif.');
    const c = controllerFor(adapter);
    await c.expand('note-2');
    expect(c.whyState('note-2')).toEqual({
      phase: 'shown',
      text: 'Both circle the same wilderness motif.',
      cached: true,
    });
  });

  it('passes through loading before shown', async () => {
    const c = controllerFor(new FakeLamplightAdapter());
    const p = c.expand('note-2');
    expect(c.whyState('note-2')).toEqual({ phase: 'loading' });
    await p;
    expect(c.whyState('note-2').phase).toBe('shown');
  });

  it('maps validators_failed to error/validators_failed', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__failNextGenerateConnectionWhy('validators_failed');
    const c = controllerFor(adapter);
    await c.expand('note-2');
    expect(c.whyState('note-2')).toEqual({ phase: 'error', reason: 'validators_failed' });
  });

  it('maps any other !ok reason to error/network', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__failNextGenerateConnectionWhy('not_neighbor');
    const c = controllerFor(adapter);
    await c.expand('note-2');
    expect(c.whyState('note-2')).toEqual({ phase: 'error', reason: 'network' });
  });

  it('maps a thrown adapter call to error/network', async () => {
    const c = new ConnectionWhy(
      { generateConnectionWhy: async () => { throw new Error('boom'); } },
      'note-1',
    );
    await c.expand('note-2');
    expect(c.whyState('note-2')).toEqual({ phase: 'error', reason: 'network' });
  });

  it('retry re-runs expand for the card', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__failNextGenerateConnectionWhy('network');
    const c = controllerFor(adapter);
    await c.retry('note-2');
    expect(c.whyState('note-2')).toEqual({ phase: 'error', reason: 'network' });
    await c.retry('note-2'); // no failure queued now ⇒ succeeds
    expect(c.whyState('note-2').phase).toBe('shown');
  });

  it('notifies subscribers on state changes', async () => {
    const c = controllerFor(new FakeLamplightAdapter());
    let count = 0;
    c.subscribe(() => { count++; });
    await c.expand('note-2'); // loading + shown ⇒ at least 2 notifications
    expect(count).toBeGreaterThanOrEqual(2);
    await tick();
  });
});
