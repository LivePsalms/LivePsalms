// src/notepad/decorations/DecorationLayer.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecorationLayer } from './DecorationLayer';
import type { NoteDecoration } from '../types';

vi.mock('../styles/manifest', () => ({
  getStyleAsset: (id: string) => ({
    id, category: 'arrow', thumbUrl: 't', displayUrl: `/d/${id}.webp`, aspectRatio: 2,
  }),
}));

const deco: NoteDecoration = {
  id: 'a', assetId: 'arrow-01', xPct: 0.5, yPx: 100, widthPct: 0.2, rotation: 10, z: 3,
};

afterEach(cleanup);

describe('DecorationLayer', () => {
  it('renders an image per decoration with the display url', () => {
    const { getByTestId } = render(
      <DecorationLayer decorations={[deco]} selectedId={null} onSelect={() => {}} onDeselect={() => {}} />,
    );
    const img = getByTestId('decoration-a').querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/d/arrow-01.webp');
  });

  it('calls onSelect when a decoration is clicked', () => {
    const onSelect = vi.fn();
    const { getByTestId } = render(
      <DecorationLayer decorations={[deco]} selectedId={null} onSelect={onSelect} onDeselect={() => {}} />,
    );
    fireEvent.mouseDown(getByTestId('decoration-a'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('calls onDeselect when the empty canvas is clicked', () => {
    const onDeselect = vi.fn();
    const { getByTestId } = render(
      <DecorationLayer decorations={[deco]} selectedId="a" onSelect={() => {}} onDeselect={onDeselect} />,
    );
    fireEvent.mouseDown(getByTestId('decoration-canvas'));
    expect(onDeselect).toHaveBeenCalled();
  });
});
