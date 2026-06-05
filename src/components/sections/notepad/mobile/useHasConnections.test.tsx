// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the underlying hook so this stays a pure unit of the wrapper logic.
vi.mock('../../../../notepad/hooks/useConnectionDiscovery', () => ({
  useConnectionDiscovery: vi.fn(),
}));
import { useConnectionDiscovery } from '../../../../notepad/hooks/useConnectionDiscovery';
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
  it('is true when discovery is in the present phase', () => {
    vi.mocked(useConnectionDiscovery).mockReturnValue({
      state: { phase: 'present', count: 2 } as never,
      retry: vi.fn(),
    });
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('has').textContent).toBe('true');
  });

  it('is false for any non-present phase', () => {
    vi.mocked(useConnectionDiscovery).mockReturnValue({
      state: { phase: 'no_connections' } as never,
      retry: vi.fn(),
    });
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('has').textContent).toBe('false');
  });
});
