// src/notepad/decorations/DecorationLayer.test.tsx
// @vitest-environment jsdom
import { createRef } from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecorationLayer, type DecorationLayerHandle } from './DecorationLayer';
import type { NoteDecoration } from '../types';

function stubRect(el: HTMLElement, left: number, top: number, width: number, height: number) {
  el.getBoundingClientRect = () => ({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top,
    toJSON() {},
  }) as DOMRect;
}

vi.mock('../styles/manifest', () => ({
  getStyleAsset: (id: string) => ({
    id, category: 'arrow', thumbUrl: 't', displayUrl: `/d/${id}.webp`, aspectRatio: 2,
  }),
}));

// jsdom has no ResizeObserver; capture the callback so a test can drive measurements.
let roCallback: ((entries: Array<{ contentRect: { width: number } }>) => void) | null = null;
vi.stubGlobal('ResizeObserver', class {
  constructor(cb: (entries: Array<{ contentRect: { width: number } }>) => void) { roCallback = cb; }
  observe() {} unobserve() {} disconnect() {}
});

const noops = {
  onChange: () => {}, onDelete: () => {}, onDuplicate: () => {},
  onBringToFront: () => {}, onSendToBack: () => {},
};

const deco: NoteDecoration = {
  id: 'a', assetId: 'arrow-01', xPct: 0.5, yPct: 0.1, widthPct: 0.2, rotation: 10, z: 3,
};

afterEach(cleanup);

describe('DecorationLayer', () => {
  it('renders an image per decoration with the display url', () => {
    const { getByTestId } = render(
      <DecorationLayer decorations={[deco]} selectedId={null} onSelect={() => {}} onDeselect={() => {}} {...noops} />,
    );
    const img = getByTestId('decoration-body-a').querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/d/arrow-01.webp');
  });

  it('calls onSelect when a decoration is clicked', () => {
    const onSelect = vi.fn();
    const { getByTestId } = render(
      <DecorationLayer decorations={[deco]} selectedId={null} onSelect={onSelect} onDeselect={() => {}} {...noops} />,
    );
    fireEvent.pointerDown(getByTestId('decoration-body-a'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('freezes the reference width at first measure and ignores later resizes', () => {
    const { getByTestId } = render(
      <DecorationLayer decorations={[deco]} selectedId={null} onSelect={() => {}} onDeselect={() => {}} {...noops} />,
    );
    act(() => roCallback!([{ contentRect: { width: 1000 } }]));
    const root = getByTestId('decoration-body-a').parentElement!;
    expect(root.style.left).toBe('500px'); // 0.5 * 1000

    // A later resize must NOT move or rescale the decoration.
    act(() => roCallback!([{ contentRect: { width: 2000 } }]));
    expect(root.style.left).toBe('500px');
  });

  it('hitTestBehind maps a viewport point to the behind-text decoration under it', () => {
    const ref = createRef<DecorationLayerHandle>();
    const back: NoteDecoration = { ...deco, behindText: true }; // xPct .5, yPct 0.1, widthPct .2
    const { getByTestId } = render(
      <DecorationLayer ref={ref} decorations={[back]} selectedId={null} onSelect={() => {}} onDeselect={() => {}} {...noops} />,
    );
    stubRect(getByTestId('decoration-canvas'), 0, 0, 1000, 2000);
    act(() => roCallback!([{ contentRect: { width: 1000 } }])); // freeze refWidth = 1000

    // box: left 500, top 100, width 200, height 100 (aspectRatio 2 from the mock).
    expect(ref.current!.hitTestBehind(550, 150)).toBe('a');
    expect(ref.current!.hitTestBehind(10, 10)).toBeNull();
  });

  it('hitTestBehind ignores front (non-behind) decorations', () => {
    const ref = createRef<DecorationLayerHandle>();
    const { getByTestId } = render(
      <DecorationLayer ref={ref} decorations={[deco]} selectedId={null} onSelect={() => {}} onDeselect={() => {}} {...noops} />,
    );
    stubRect(getByTestId('decoration-canvas'), 0, 0, 1000, 2000);
    act(() => roCallback!([{ contentRect: { width: 1000 } }]));
    expect(ref.current!.hitTestBehind(550, 150)).toBeNull();
  });

  it('calls onDeselect when the empty canvas is clicked', () => {
    const onDeselect = vi.fn();
    const { getByTestId } = render(
      <DecorationLayer decorations={[deco]} selectedId="a" onSelect={() => {}} onDeselect={onDeselect} {...noops} />,
    );
    fireEvent.mouseDown(getByTestId('decoration-canvas'));
    expect(onDeselect).toHaveBeenCalled();
  });
});
