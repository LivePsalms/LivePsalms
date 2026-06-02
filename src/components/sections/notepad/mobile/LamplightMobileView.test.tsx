// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../notepad/components/lamplight/LamplightTabPanel', () => ({
  LamplightTabPanel: () => <div data-testid="todays-lamp" />,
}));
vi.mock('../../../../notepad/components/lamplight/ConnectionCardsStrip', () => ({
  ConnectionCardsStrip: () => <div data-testid="connections" />,
}));
import { LamplightMobileView } from './LamplightMobileView';

afterEach(cleanup);

const props = {
  lamplightAdapter: {} as never,
  userId: 'u1',
  activeNote: { id: 'n1' } as never,
  totalNoteCount: 5,
  loadNeighborNotes: async () => [],
  onOpenNote: vi.fn(),
};

describe('<LamplightMobileView />', () => {
  it("defaults to Today's Lamp", () => {
    const { getByTestId, queryByTestId } = render(<LamplightMobileView {...props} />);
    expect(getByTestId('todays-lamp')).toBeTruthy();
    expect(queryByTestId('connections')).toBeNull();
  });

  it('switches to Connections when that segment is chosen', () => {
    const { getByRole, getByTestId, queryByTestId } = render(<LamplightMobileView {...props} />);
    fireEvent.click(getByRole('button', { name: 'Connection Cards' }));
    expect(getByTestId('connections')).toBeTruthy();
    expect(queryByTestId('todays-lamp')).toBeNull();
  });
});
