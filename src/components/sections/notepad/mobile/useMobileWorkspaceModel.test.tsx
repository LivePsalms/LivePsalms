// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: () => ({ user: { id: 'u1' }, adapter: {} }),
}));
vi.mock('../../../../notepad/context/useNoteCollection', () => ({
  useNoteCollection: () => ({
    notes: [{ id: 'n1' }, { id: 'n2' }],
    activeNote: { id: 'n1' },
    collection: { openNote: vi.fn(), createNote: vi.fn() },
  }),
}));
vi.mock('../../../../notepad/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../../../../notepad/hooks/useLamplightSettings', () => ({
  useLamplightSettings: () => ({ settings: { enabled: true } }),
}));
vi.mock('../../../../notepad/hooks/useLamplightEmbeddingTrigger', () => ({
  useLamplightEmbeddingTrigger: () => vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: null }));

import { useMobileWorkspaceModel } from './useMobileWorkspaceModel';

afterEach(cleanup);

function Probe() {
  const m = useMobileWorkspaceModel();
  return (
    <div>
      <span data-testid="user">{m.user?.id ?? 'none'}</span>
      <span data-testid="count">{m.totalNoteCount}</span>
      <span data-testid="active">{m.activeNote?.id ?? 'none'}</span>
    </div>
  );
}

describe('useMobileWorkspaceModel', () => {
  it('exposes user, notes count, and active note from context', () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('user').textContent).toBe('u1');
    expect(getByTestId('count').textContent).toBe('2');
    expect(getByTestId('active').textContent).toBe('n1');
  });

  it('provides a loadNeighborNotes that filters the note list by id', async () => {
    let result: unknown;
    function Probe2() {
      const m = useMobileWorkspaceModel();
      result = m.loadNeighborNotes;
      return null;
    }
    render(<Probe2 />);
    const notes = await (result as (ids: string[]) => Promise<{ id: string }[]>)(['n2']);
    expect(notes).toEqual([{ id: 'n2' }]);
  });
});
