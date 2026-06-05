import { describe, it, expect, vi } from 'vitest';
import { recordLamplightUsage, type UsageRow } from './usage';

function fakeSupabase(insertImpl: (row: unknown) => Promise<{ error: { message: string } | null }>) {
  return {
    from: () => ({ insert: insertImpl }),
  } as unknown as Parameters<typeof recordLamplightUsage>[0];
}

const baseRow: UsageRow = {
  user_id: 'u1',
  model: 'voyage-3-large',
  artifact_kind: 'embedding_refresh',
  tokens_in: 100,
  tokens_out: 0,
  status: 'ok',
};

describe('recordLamplightUsage', () => {
  it('inserts the row and resolves on success', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    await recordLamplightUsage(fakeSupabase(insert), baseRow);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(baseRow);
  });

  it('does not throw on insert error — logs and resolves', async () => {
    const insert = vi.fn(async () => ({ error: { message: 'rls_violation' } }));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(recordLamplightUsage(fakeSupabase(insert), baseRow)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('accepts a null model (pre-model failure) and inserts it verbatim', async () => {
    const nullModelRow: UsageRow = {
      user_id: 'u1',
      model: null,
      artifact_kind: 'daily_devotion',
      tokens_in: 0,
      tokens_out: 0,
      status: 'error',
      error_code: 'quota_exceeded',
    };
    const insert = vi.fn(async () => ({ error: null }));
    await recordLamplightUsage(fakeSupabase(insert), nullModelRow);
    expect(insert).toHaveBeenCalledWith(nullModelRow);
  });
});
