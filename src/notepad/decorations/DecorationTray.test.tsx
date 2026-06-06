// src/notepad/decorations/DecorationTray.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecorationTray } from './DecorationTray';
import type { StyleAsset } from '../styles/manifest';

const assets: StyleAsset[] = [
  { id: 'arrow-01', category: 'arrow', thumbUrl: 'ta', displayUrl: 'da', aspectRatio: 2 },
  { id: 'shape-01', category: 'shape', thumbUrl: 'ts', displayUrl: 'ds', aspectRatio: 1 },
  // Highlights are never shown in the tray; they live in the selection popover.
  { id: 'highlight-01', category: 'highlight', thumbUrl: 'th', displayUrl: 'dh', aspectRatio: 1 },
];

afterEach(cleanup);

describe('DecorationTray', () => {
  it('lists thumbnails for the active category', () => {
    const { getByLabelText, queryByLabelText } = render(
      <DecorationTray assets={assets} onPlace={() => {}} onClose={() => {}} />,
    );
    // Default category 'all' shows the decoration assets...
    expect(getByLabelText('Place arrow-01')).toBeTruthy();
    expect(queryByLabelText('Place shape-01')).toBeTruthy();
    // ...but excludes highlight-category assets, which live in the selection popover.
    expect(queryByLabelText('Place highlight-01')).toBeNull();
  });

  it('filters by category pill', () => {
    const { getByText, queryByLabelText } = render(
      <DecorationTray assets={assets} onPlace={() => {}} onClose={() => {}} />,
    );
    fireEvent.click(getByText('Arrows'));
    expect(queryByLabelText('Place arrow-01')).toBeTruthy();
    expect(queryByLabelText('Place shape-01')).toBeNull();
  });

  it('filters by search text', () => {
    const { getByLabelText, queryByLabelText } = render(
      <DecorationTray assets={assets} onPlace={() => {}} onClose={() => {}} />,
    );
    fireEvent.change(getByLabelText('Search decorations'), { target: { value: 'shape' } });
    expect(queryByLabelText('Place arrow-01')).toBeNull();
    expect(queryByLabelText('Place shape-01')).toBeTruthy();
  });

  it('calls onPlace with the asset id on tap', () => {
    const onPlace = vi.fn();
    const { getByLabelText } = render(
      <DecorationTray assets={assets} onPlace={onPlace} onClose={() => {}} />,
    );
    fireEvent.click(getByLabelText('Place arrow-01'));
    expect(onPlace).toHaveBeenCalledWith('arrow-01');
  });
});
