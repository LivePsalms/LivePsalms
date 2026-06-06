// src/notepad/decorations/DecorationItem.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecorationItem } from './DecorationItem';
import type { NoteDecoration } from '../types';

vi.mock('../styles/manifest', () => ({
  getStyleAsset: (id: string) => ({
    id, category: 'arrow', thumbUrl: 't', displayUrl: `/d/${id}.webp`, aspectRatio: 2,
  }),
}));

const d: NoteDecoration = {
  id: 'a', assetId: 'arrow-01', xPct: 0.5, yPx: 100, widthPct: 0.2, rotation: 0, z: 3,
};

const handlers = () => ({
  onChange: vi.fn(), onSelect: vi.fn(), onDelete: vi.fn(),
  onDuplicate: vi.fn(), onBringToFront: vi.fn(), onSendToBack: vi.fn(),
  contentWidth: 1000,
});

afterEach(cleanup);

describe('DecorationItem', () => {
  it('shows the action bar only when selected', () => {
    const h = handlers();
    const { rerender, queryByLabelText } = render(
      <DecorationItem decoration={d} selected={false} {...h} />,
    );
    expect(queryByLabelText('Delete decoration')).toBeNull();
    rerender(<DecorationItem decoration={d} selected={true} {...h} />);
    expect(queryByLabelText('Delete decoration')).not.toBeNull();
  });

  it('fires the action-bar callbacks', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
    fireEvent.click(getByLabelText('Delete decoration'));
    fireEvent.click(getByLabelText('Duplicate decoration'));
    fireEvent.click(getByLabelText('Bring to front'));
    fireEvent.click(getByLabelText('Send to back'));
    expect(h.onDelete).toHaveBeenCalledWith('a');
    expect(h.onDuplicate).toHaveBeenCalledWith('a');
    expect(h.onBringToFront).toHaveBeenCalledWith('a');
    expect(h.onSendToBack).toHaveBeenCalledWith('a');
  });

  it('emits a moved decoration on body drag', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationItem decoration={d} selected {...h} />);
    const body = getByTestId('decoration-body-a');
    fireEvent.pointerDown(body, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(body, { clientX: 100, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(body, { pointerId: 1 });
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', xPct: expect.closeTo(0.6, 5), yPx: 130 }),
    );
  });

  it('emits a rotated decoration when the rotate handle is pressed', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
    fireEvent.pointerDown(getByLabelText('Rotate decoration'), { pointerId: 1 });
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', rotation: 15 }),
    );
  });

  it('emits a wider decoration when the resize handle is dragged', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
    const handle = getByLabelText('Resize decoration');
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', widthPct: expect.closeTo(0.3, 5) }),
    );
  });
});
