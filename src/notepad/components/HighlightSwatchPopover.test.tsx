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
        onPick={onPick} onRemove={() => {}} onClose={() => {}} anchor={{ top: 0, left: 0 }}
      />,
    );
    fireEvent.click(getByLabelText('Highlight highlight-60'));
    expect(onPick).toHaveBeenCalledWith('highlight-60');
  });

  it('filters swatches by the query', () => {
    const { queryByLabelText } = render(
      <HighlightSwatchPopover
        assets={assets} query="90" onQueryChange={() => {}}
        onPick={() => {}} onRemove={() => {}} onClose={() => {}} anchor={{ top: 0, left: 0 }}
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
        onPick={() => {}} onRemove={onRemove} onClose={() => {}} anchor={{ top: 0, left: 0 }}
      />,
    );
    fireEvent.click(getByLabelText('Remove highlight'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('header ✕ closes the window and does not remove the highlight', () => {
    const onClose = vi.fn();
    const onRemove = vi.fn();
    const { getByLabelText } = render(
      <HighlightSwatchPopover
        assets={assets} query="" onQueryChange={() => {}}
        onPick={() => {}} onRemove={onRemove} onClose={onClose} anchor={{ top: 0, left: 0 }}
      />,
    );
    fireEvent.click(getByLabelText('Close highlights'));
    expect(onClose).toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('reset cell removes the highlight without closing', () => {
    const onClose = vi.fn();
    const onRemove = vi.fn();
    const { getByLabelText } = render(
      <HighlightSwatchPopover
        assets={assets} query="" onQueryChange={() => {}}
        onPick={() => {}} onRemove={onRemove} onClose={onClose} anchor={{ top: 0, left: 0 }}
      />,
    );
    fireEvent.click(getByLabelText('Remove highlight'));
    expect(onRemove).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on an outside (document) pointerdown', () => {
    const onClose = vi.fn();
    render(
      <HighlightSwatchPopover
        assets={assets} query="" onQueryChange={() => {}}
        onPick={() => {}} onRemove={() => {}} onClose={onClose} anchor={{ top: 0, left: 0 }}
      />,
    );
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT close on a pointerdown inside the popover', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <HighlightSwatchPopover
        assets={assets} query="" onQueryChange={() => {}}
        onPick={() => {}} onRemove={() => {}} onClose={onClose} anchor={{ top: 0, left: 0 }}
      />,
    );
    fireEvent.pointerDown(getByLabelText('Search highlights'));
    fireEvent.pointerDown(getByLabelText('Highlight highlight-60'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the reset cell visible even when the query filters out swatches', () => {
    const { getByLabelText, queryByLabelText } = render(
      <HighlightSwatchPopover
        assets={assets} query="90" onQueryChange={() => {}}
        onPick={() => {}} onRemove={() => {}} onClose={() => {}} anchor={{ top: 0, left: 0 }}
      />,
    );
    expect(queryByLabelText('Highlight highlight-60')).toBeNull();
    expect(getByLabelText('Remove highlight')).not.toBeNull();
  });
});
