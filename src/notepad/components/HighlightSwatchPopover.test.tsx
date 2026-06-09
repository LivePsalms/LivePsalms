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
        onPick={onPick} onRemove={() => {}} onClose={() => {}} autoFocus={false} anchor={{ top: 0, left: 0 }}
      />,
    );
    fireEvent.click(getByLabelText('Highlight highlight-60'));
    expect(onPick).toHaveBeenCalledWith('highlight-60');
  });

  it('filters swatches by the query', () => {
    const { queryByLabelText } = render(
      <HighlightSwatchPopover
        assets={assets} query="90" onQueryChange={() => {}}
        onPick={() => {}} onRemove={() => {}} onClose={() => {}} autoFocus={false} anchor={{ top: 0, left: 0 }}
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
        onPick={() => {}} onRemove={onRemove} onClose={() => {}} autoFocus={false} anchor={{ top: 0, left: 0 }}
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
        onPick={() => {}} onRemove={onRemove} onClose={onClose} autoFocus={false} anchor={{ top: 0, left: 0 }}
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
        onPick={() => {}} onRemove={onRemove} onClose={onClose} autoFocus={false} anchor={{ top: 0, left: 0 }}
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
        onPick={() => {}} onRemove={() => {}} onClose={onClose} autoFocus={false} anchor={{ top: 0, left: 0 }}
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
        onPick={() => {}} onRemove={() => {}} onClose={onClose} autoFocus={false} anchor={{ top: 0, left: 0 }}
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
        onPick={() => {}} onRemove={() => {}} onClose={() => {}} autoFocus={false} anchor={{ top: 0, left: 0 }}
      />,
    );
    expect(queryByLabelText('Highlight highlight-60')).toBeNull();
    expect(getByLabelText('Remove highlight')).not.toBeNull();
  });
});

// ---- New keyboard tests (Task 3) ----

const kbAssets: StyleAsset[] = [
  { id: 'highlight-01', category: 'highlight', thumbUrl: 't1', displayUrl: 'd1', aspectRatio: 1 },
  { id: 'highlight-02', category: 'highlight', thumbUrl: 't2', displayUrl: 'd2', aspectRatio: 1 },
  { id: 'highlight-03', category: 'highlight', thumbUrl: 't3', displayUrl: 'd3', aspectRatio: 1 },
];

const baseProps = () => ({
  assets: kbAssets,
  query: '',
  onQueryChange: vi.fn(),
  onPick: vi.fn(),
  onRemove: vi.fn(),
  onClose: vi.fn(),
  onRequestEditorFocus: vi.fn(),
  anchor: { top: 0, left: 0 },
});

describe('HighlightSwatchPopover keyboard', () => {
  it('auto-focuses the first swatch when autoFocus is true', () => {
    const p = baseProps();
    const { getByLabelText } = render(<HighlightSwatchPopover {...p} autoFocus />);
    expect(document.activeElement).toBe(getByLabelText('Highlight highlight-01'));
  });

  it('does not steal focus when autoFocus is false', () => {
    const p = baseProps();
    render(<HighlightSwatchPopover {...p} autoFocus={false} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('moves roving focus with arrows and applies with Enter', () => {
    const p = baseProps();
    const { getByLabelText } = render(<HighlightSwatchPopover {...p} autoFocus />);
    const first = getByLabelText('Highlight highlight-01');
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(getByLabelText('Highlight highlight-02'));
    fireEvent.keyDown(getByLabelText('Highlight highlight-02'), { key: 'Enter' });
    expect(p.onPick).toHaveBeenCalledWith('highlight-02');
  });

  it('removes with Delete and closes with Escape (returning editor focus)', () => {
    const p = baseProps();
    const { getByLabelText } = render(<HighlightSwatchPopover {...p} autoFocus />);
    const first = getByLabelText('Highlight highlight-01');
    fireEvent.keyDown(first, { key: 'Delete' });
    expect(p.onRemove).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(p.onClose).toHaveBeenCalledTimes(1);
    expect(p.onRequestEditorFocus).toHaveBeenCalledTimes(1);
  });

  it('applies the focused swatch with Space without double-firing', () => {
    const p = baseProps();
    const { getByLabelText } = render(<HighlightSwatchPopover {...p} autoFocus />);
    fireEvent.keyDown(getByLabelText('Highlight highlight-01'), { key: ' ' });
    expect(p.onPick).toHaveBeenCalledTimes(1);
    expect(p.onPick).toHaveBeenCalledWith('highlight-01');
  });

  it('clamps roving focus at the ends', () => {
    const p = baseProps();
    const { getByLabelText } = render(<HighlightSwatchPopover {...p} autoFocus />);
    const first = getByLabelText('Highlight highlight-01');
    // ArrowLeft at index 0 stays on the first swatch.
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
    // Walk to the last swatch, then ArrowRight again stays put.
    fireEvent.keyDown(getByLabelText('Highlight highlight-01'), { key: 'ArrowRight' });
    fireEvent.keyDown(getByLabelText('Highlight highlight-02'), { key: 'ArrowRight' });
    const last = getByLabelText('Highlight highlight-03');
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(last);
  });
});
