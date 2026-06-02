// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the underlying hook so this test stays a pure unit of the wrapper logic.
vi.mock('../../../../notepad/hooks/useConnectionCards', () => ({
  useConnectionCards: vi.fn(),
}));
import { useConnectionCards } from '../../../../notepad/hooks/useConnectionCards';
import { useHasConnections } from './useHasConnections';

afterEach(cleanup);

const baseArgs = {
  adapter: {} as never,
  userId: 'u1',
  activeNote: { id: 'n1' } as never,
  totalNoteCount: 5,
  loadNeighborNotes: async () => [],
};

function Probe() {
  const has = useHasConnections(baseArgs);
  return <div data-testid="has">{String(has)}</div>;
}

describe('useHasConnections', () => {
  it('is true when the connection-cards state is ready with cards', () => {
    vi.mocked(useConnectionCards).mockReturnValue({
      state: { phase: 'ready', cards: [{ relatedNoteId: 'x' }] } as never,
      expandCard: vi.fn(),
      retryWhy: vi.fn(),
    });
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('has').textContent).toBe('true');
  });

  it('is false for any non-ready phase', () => {
    vi.mocked(useConnectionCards).mockReturnValue({
      state: { phase: 'no_connections' } as never,
      expandCard: vi.fn(),
      retryWhy: vi.fn(),
    });
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('has').textContent).toBe('false');
  });
});
