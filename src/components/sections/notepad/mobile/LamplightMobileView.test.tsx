// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { tabPanelSpy } = vi.hoisted(() => ({ tabPanelSpy: vi.fn() }));
vi.mock('../../../../notepad/components/lamplight/LamplightTabPanel', () => ({
  LamplightTabPanel: (props: { autoGenerate?: boolean }) => {
    tabPanelSpy(props);
    return <div data-testid="todays-lamp" />;
  },
}));
const { panelSpy } = vi.hoisted(() => ({ panelSpy: vi.fn() }));
vi.mock('../../../../notepad/components/lamplight/ConnectionCardsPanel', () => ({
  ConnectionCardsPanel: (props: { showEmptyStates?: boolean }) => {
    panelSpy(props);
    return <div data-testid="connections" />;
  },
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

  it("passes autoGenerate=false to the Today's Lamp panel (no auto-generate on mobile)", () => {
    tabPanelSpy.mockClear();
    render(<LamplightMobileView {...props} />);
    expect(tabPanelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ autoGenerate: false }),
    );
  });

  it('renders the connections panel with showEmptyStates enabled', () => {
    panelSpy.mockClear();
    const { getByRole } = render(<LamplightMobileView {...props} />);
    fireEvent.click(getByRole('button', { name: 'Connection Cards' }));
    expect(panelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ showEmptyStates: true }),
    );
  });

  it('renders the connections panel with the vertical stack layout', () => {
    panelSpy.mockClear();
    const { getByRole } = render(<LamplightMobileView {...props} />);
    fireEvent.click(getByRole('button', { name: 'Connection Cards' }));
    expect(panelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ layout: 'stack' }),
    );
  });

  it('shows the sign-in fallback on the Connections segment when signed out', () => {
    const { getByRole, getByText, queryByTestId } = render(
      <LamplightMobileView {...props} userId={null} />,
    );
    fireEvent.click(getByRole('button', { name: 'Connection Cards' }));
    expect(getByText('Sign in to see connections.')).toBeInTheDocument();
    expect(queryByTestId('connections')).toBeNull();
  });
});
