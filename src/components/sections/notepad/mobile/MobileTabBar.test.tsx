// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileTabBar } from './MobileTabBar';

afterEach(cleanup);

describe('<MobileTabBar />', () => {
  it('renders all four tabs and marks the active one', () => {
    const { getByRole } = render(
      <MobileTabBar active="editor" onSelect={() => {}} lamplightHasConnections={false} />,
    );
    expect(getByRole('tab', { name: /Notes/ })).toBeTruthy();
    expect(getByRole('tab', { name: /Editor/ }).getAttribute('aria-selected')).toBe('true');
    expect(getByRole('tab', { name: /Lamplight/ })).toBeTruthy();
    expect(getByRole('tab', { name: /More/ })).toBeTruthy();
  });

  it('calls onSelect with the tab id when a tab is tapped', () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <MobileTabBar active="notes" onSelect={onSelect} lamplightHasConnections={false} />,
    );
    fireEvent.click(getByRole('tab', { name: /Lamplight/ }));
    expect(onSelect).toHaveBeenCalledWith('lamplight');
  });

  it('shows the connection glow-dot only when lamplightHasConnections is true', () => {
    const { rerender, container } = render(
      <MobileTabBar active="notes" onSelect={() => {}} lamplightHasConnections={false} />,
    );
    expect(container.querySelector('[data-testid="lamplight-dot"]')).toBeNull();
    rerender(
      <MobileTabBar active="notes" onSelect={() => {}} lamplightHasConnections={true} />,
    );
    expect(container.querySelector('[data-testid="lamplight-dot"]')).not.toBeNull();
  });
});
