// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../notepad/components/BacklinksPanel', () => ({ BacklinksPanel: () => <div data-testid="backlinks" /> }));
vi.mock('../../../../notepad/components/InfoPanel', () => ({ InfoPanel: () => <div data-testid="info" /> }));
vi.mock('../GraphPane', () => ({ GraphPane: () => <div data-testid="graph" /> }));
vi.mock('../../../../notepad/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
import { MobileMoreSheet } from './MobileMoreSheet';

afterEach(cleanup);

describe('<MobileMoreSheet />', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MobileMoreSheet open={false} onClose={vi.fn()} />);
    expect(container.querySelector('[data-testid="backlinks"]')).toBeNull();
  });

  it('shows Backlinks by default and switches panels via the segmented control', () => {
    const { getByTestId, queryByTestId, getByRole } = render(<MobileMoreSheet open onClose={vi.fn()} />);
    expect(getByTestId('backlinks')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Graph' }));
    expect(getByTestId('graph')).toBeTruthy();
    expect(queryByTestId('backlinks')).toBeNull();
  });

  it('calls onClose when the backdrop is tapped', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<MobileMoreSheet open onClose={onClose} />);
    fireEvent.click(getByLabelText('Close details'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
