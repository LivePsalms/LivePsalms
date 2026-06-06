// src/notepad/decorations/DecorationItem.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecorationItem } from './DecorationItem';
import { TEXT_Z, SELECTED_Z } from './decoration-geometry';
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

  it('steps rotation by 15 degrees from the action-bar rotate button', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
    fireEvent.click(getByLabelText('Rotate decoration 15 degrees'));
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', rotation: 15 }),
    );
  });

  it('steps rotation backward by 15 degrees, wrapping past 0', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
    fireEvent.click(getByLabelText('Rotate decoration counterclockwise 15 degrees'));
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', rotation: 345 }),
    );
  });

  it('toggles flipH and reflects scaleX(-1) in the body transform (not the chrome)', () => {
    const h = handlers();
    const { getByLabelText, getByTestId, rerender } = render(
      <DecorationItem decoration={d} selected {...h} />,
    );
    fireEvent.click(getByLabelText('Flip horizontal'));
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', flipH: true }),
    );
    rerender(<DecorationItem decoration={{ ...d, flipH: true }} selected {...h} />);
    // Flip lives on the asset body so handles/action-bar glyphs stay un-mirrored.
    const body = getByTestId('decoration-body-a');
    expect(body.style.transform).toContain('scaleX(-1)');
    expect(body.parentElement!.style.transform).not.toContain('scaleX(-1)');
  });

  it('toggles flipV and reflects scaleY(-1) in the body transform (not the chrome)', () => {
    const h = handlers();
    const { getByLabelText, getByTestId, rerender } = render(
      <DecorationItem decoration={d} selected {...h} />,
    );
    fireEvent.click(getByLabelText('Flip vertical'));
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', flipV: true }),
    );
    rerender(<DecorationItem decoration={{ ...d, flipV: true }} selected {...h} />);
    const body = getByTestId('decoration-body-a');
    expect(body.style.transform).toContain('scaleY(-1)');
    expect(body.parentElement!.style.transform).not.toContain('scaleY(-1)');
  });

  it('renders the computed zIndex for selected, behind-text, and default cases', () => {
    const h = handlers();
    const { getByTestId, rerender } = render(<DecorationItem decoration={d} selected {...h} />);
    const root = () => getByTestId('decoration-body-a').parentElement!;
    expect(root().style.zIndex).toBe(String(SELECTED_Z));

    rerender(<DecorationItem decoration={{ ...d, behindText: true }} selected={false} {...h} />);
    expect(root().style.zIndex).toBe(String(d.z));

    rerender(<DecorationItem decoration={d} selected={false} {...h} />);
    expect(root().style.zIndex).toBe(String(TEXT_Z + d.z));
  });

  it('drag-rotates via the rotate handle (jsdom center at origin)', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
    const handle = getByLabelText('Rotate decoration');
    // jsdom getBoundingClientRect is 0,0 so center is origin.
    // Down at (10,0) -> angle 0; move to (0,10) -> angle 90; startRotation 0 -> ~90.
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 0, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    const last = h.onChange.mock.calls.at(-1)![0] as NoteDecoration;
    expect(last.rotation).toBeCloseTo(90, 5);
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

  it('emits a pinch-scaled decoration when a second pointer is added and moved', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationItem decoration={d} selected {...h} />);
    const body = getByTestId('decoration-body-a');
    fireEvent.pointerDown(body, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerDown(body, { clientX: 100, clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(body, { clientX: 200, clientY: 0, pointerId: 2 });
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', widthPct: expect.closeTo(0.4, 5) }),
    );
  });
});
