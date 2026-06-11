// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighlightPill } from './HighlightPill';
import type { StyleAsset } from '../styles/manifest';

const assets: StyleAsset[] = [
  { id: 'highlight-01', category: 'highlight', thumbUrl: '/styles/highlight/highlight-01.thumb.webp' } as StyleAsset,
  { id: 'highlight-02', category: 'highlight', thumbUrl: '/styles/highlight/highlight-02.thumb.webp' } as StyleAsset,
  { id: 'arrow-01', category: 'arrow', thumbUrl: '/styles/arrow/arrow-01.thumb.webp' } as StyleAsset,
];

afterEach(cleanup);

describe('HighlightPill', () => {
  it('renders only highlight swatches plus a remove chip', () => {
    const { getByLabelText, queryByLabelText } = render(
      <HighlightPill assets={assets} anchor={{ bottom: 100, left: 30 }} onPick={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />
    );
    expect(getByLabelText('Remove highlight')).not.toBeNull();
    expect(getByLabelText('Highlight highlight-01')).not.toBeNull();
    expect(getByLabelText('Highlight highlight-02')).not.toBeNull();
    expect(queryByLabelText('Highlight arrow-01')).toBeNull(); // non-highlight filtered out
  });

  it('calls onPick with the swatch id when a swatch is tapped', () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(
      <HighlightPill assets={assets} anchor={{ bottom: 100, left: 30 }} onPick={onPick} onRemove={vi.fn()} onClose={vi.fn()} />
    );
    fireEvent.click(getByLabelText('Highlight highlight-01'));
    expect(onPick).toHaveBeenCalledWith('highlight-01');
  });

  it('calls onRemove when the remove chip is tapped', () => {
    const onRemove = vi.fn();
    const { getByLabelText } = render(
      <HighlightPill assets={assets} anchor={{ bottom: 100, left: 30 }} onPick={vi.fn()} onRemove={onRemove} onClose={vi.fn()} />
    );
    fireEvent.click(getByLabelText('Remove highlight'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('applies the anchor (bottom vs top) to the fixed container', () => {
    const { getByRole, rerender } = render(
      <HighlightPill assets={assets} anchor={{ bottom: 120, left: 30 }} onPick={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />
    );
    const elBottom = getByRole('dialog') as HTMLElement;
    expect(elBottom.style.position).toBe('fixed');
    expect(elBottom.style.bottom).toBe('120px');
    expect(elBottom.style.left).toBe('30px');

    rerender(
      <HighlightPill assets={assets} anchor={{ top: 80, left: 30 }} onPick={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />
    );
    const elTop = getByRole('dialog') as HTMLElement;
    expect(elTop.style.top).toBe('80px');
  });

  it('closes on an outside pointerdown', () => {
    const onClose = vi.fn();
    render(
      <HighlightPill assets={assets} anchor={{ bottom: 100, left: 30 }} onPick={vi.fn()} onRemove={vi.fn()} onClose={onClose} />
    );
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});
