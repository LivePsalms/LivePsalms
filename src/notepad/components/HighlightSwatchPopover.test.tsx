// src/notepad/components/HighlightSwatchPopover.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighlightSwatchPopover } from './HighlightSwatchPopover';
import type { StyleAsset } from '../styles/manifest';

const assets: StyleAsset[] = [
  { id: 'highlight-60', category: 'highlight', thumbUrl: 't60', displayUrl: 'd60', aspectRatio: 4 },
  { id: 'highlight-90', category: 'highlight', thumbUrl: 't90', displayUrl: 'd90', aspectRatio: 4 },
];

afterEach(cleanup);

describe('HighlightSwatchPopover', () => {
  it('calls onPick with the swatch id when a swatch is clicked', () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(
      <HighlightSwatchPopover
        assets={assets} query="" onQueryChange={() => {}}
        onPick={onPick} onRemove={() => {}} anchor={{ top: 0, left: 0 }}
      />,
    );
    fireEvent.click(getByLabelText('Highlight highlight-60'));
    expect(onPick).toHaveBeenCalledWith('highlight-60');
  });

  it('filters swatches by the query', () => {
    const { queryByLabelText } = render(
      <HighlightSwatchPopover
        assets={assets} query="90" onQueryChange={() => {}}
        onPick={() => {}} onRemove={() => {}} anchor={{ top: 0, left: 0 }}
      />,
    );
    expect(queryByLabelText('Highlight highlight-60')).toBeNull();
    expect(queryByLabelText('Highlight highlight-90')).not.toBeNull();
  });

  it('calls onRemove when the remove affordance is clicked', () => {
    const onRemove = vi.fn();
    const { getByLabelText } = render(
      <HighlightSwatchPopover
        assets={assets} query="" onQueryChange={() => {}}
        onPick={() => {}} onRemove={onRemove} anchor={{ top: 0, left: 0 }}
      />,
    );
    fireEvent.click(getByLabelText('Remove highlight'));
    expect(onRemove).toHaveBeenCalled();
  });
});
