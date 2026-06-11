// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighlightSwatchPopover } from './HighlightSwatchPopover';

// The manifest helper filters assets by category/query; stub to an empty list
// so the test focuses purely on positioning.
vi.mock('../styles/manifest', () => ({
  filterAssets: () => [],
}));

afterEach(cleanup);

const baseProps = {
  assets: [],
  query: '',
  onQueryChange: vi.fn(),
  onPick: vi.fn(),
  onRemove: vi.fn(),
  onClose: vi.fn(),
  autoFocus: false,
};

describe('HighlightSwatchPopover anchoring', () => {
  it('top-anchors when given a top coordinate (desktop)', () => {
    const { getByRole } = render(
      <HighlightSwatchPopover {...baseProps} anchor={{ top: 120, left: 40 }} />,
    );
    const dialog = getByRole('dialog') as HTMLElement;
    expect(dialog.style.top).toBe('120px');
    expect(dialog.style.bottom).toBe('');
    expect(dialog.style.left).toBe('40px');
  });

  it('bottom-anchors when given a bottom coordinate (mobile)', () => {
    const { getByRole } = render(
      <HighlightSwatchPopover {...baseProps} anchor={{ bottom: 80, left: 40 }} />,
    );
    const dialog = getByRole('dialog') as HTMLElement;
    expect(dialog.style.bottom).toBe('80px');
    expect(dialog.style.top).toBe('');
    expect(dialog.style.left).toBe('40px');
  });
});
