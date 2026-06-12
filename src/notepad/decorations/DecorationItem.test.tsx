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
  onDeselect: vi.fn(),
  contentWidth: 1000,
});

afterEach(cleanup);

describe('DecorationItem', () => {
  it('renders left/top/width as fixed pixels derived from the reference width', () => {
    // Decorations are pinned to a frozen reference width (px), not container
    // percentages, so a window resize never moves or rescales them.
    const h = handlers(); // contentWidth: 1000
    const { getByTestId } = render(<DecorationItem decoration={d} selected={false} {...h} />);
    const root = getByTestId('decoration-body-a').parentElement!;
    expect(root.style.left).toBe('500px'); // 0.5 * 1000
    expect(root.style.top).toBe('100px'); // yPx, unchanged
    expect(root.style.width).toBe('200px'); // 0.2 * 1000
  });

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

  it('emits a moved decoration when the selection drag surface is dragged', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationItem decoration={d} selected {...h} />);
    // While selected, interaction lives on the top chrome surface so the body
    // image can sit at its true layer (e.g. behind the text).
    const surface = getByTestId('decoration-surface-a');
    fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 100, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(surface, { pointerId: 1 });
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

  it('renders the body image at its true layer while the chrome stays on top', () => {
    // The image z reflects behindText/front IMMEDIATELY (even while selected), so
    // "send to back" / "bring to front" update live. The selection chrome stays at
    // SELECTED_Z so handles remain grabbable.
    const h = handlers();
    const { getByTestId, queryByTestId, rerender } = render(<DecorationItem decoration={d} selected {...h} />);
    const imageRoot = () => getByTestId('decoration-body-a').parentElement!;
    const chrome = () => getByTestId('decoration-chrome-a');

    // selected, in front of text: image at TEXT_Z + z, chrome at SELECTED_Z.
    expect(imageRoot().style.zIndex).toBe(String(TEXT_Z + d.z));
    expect(chrome().style.zIndex).toBe(String(SELECTED_Z));

    // selected AND sent to back: image drops behind text instantly; chrome stays on top.
    rerender(<DecorationItem decoration={{ ...d, behindText: true }} selected {...h} />);
    expect(imageRoot().style.zIndex).toBe(String(d.z));
    expect(chrome().style.zIndex).toBe(String(SELECTED_Z));

    // not selected: no chrome; image carries the layer.
    rerender(<DecorationItem decoration={{ ...d, behindText: true }} selected={false} {...h} />);
    expect(imageRoot().style.zIndex).toBe(String(d.z));
    expect(queryByTestId('decoration-chrome-a')).toBeNull();

    rerender(<DecorationItem decoration={d} selected={false} {...h} />);
    expect(imageRoot().style.zIndex).toBe(String(TEXT_Z + d.z));
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
    const body = getByTestId('decoration-surface-a');
    fireEvent.pointerDown(body, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerDown(body, { clientX: 100, clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(body, { clientX: 200, clientY: 0, pointerId: 2 });
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', widthPct: expect.closeTo(0.4, 5) }),
    );
  });

  it('focuses the selection chrome when it becomes selected', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationItem decoration={d} selected {...h} />);
    expect(document.activeElement).toBe(getByTestId('decoration-chrome-a'));
  });

  it('nudges position with arrow keys (Shift = larger step)', () => {
    const h = handlers(); // contentWidth: 1000, d.xPct 0.5, d.yPx 100
    const { getByTestId } = render(<DecorationItem decoration={d} selected {...h} />);
    const chrome = getByTestId('decoration-chrome-a');

    fireEvent.keyDown(chrome, { key: 'ArrowRight' });
    expect(h.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ xPct: expect.closeTo(0.501, 5) }));

    fireEvent.keyDown(chrome, { key: 'ArrowRight', shiftKey: true });
    expect(h.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ xPct: expect.closeTo(0.51, 5) }));

    fireEvent.keyDown(chrome, { key: 'ArrowUp' });
    expect(h.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ yPx: 99 }));

    fireEvent.keyDown(chrome, { key: 'ArrowDown' });
    expect(h.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ yPx: 101 }));
  });

  it('deletes with Delete and Backspace', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationItem decoration={d} selected {...h} />);
    const chrome = getByTestId('decoration-chrome-a');
    fireEvent.keyDown(chrome, { key: 'Delete' });
    fireEvent.keyDown(chrome, { key: 'Backspace' });
    expect(h.onDelete).toHaveBeenCalledTimes(2);
    expect(h.onDelete).toHaveBeenCalledWith('a');
  });

  it('deselects with Escape', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationItem decoration={d} selected {...h} />);
    fireEvent.keyDown(getByTestId('decoration-chrome-a'), { key: 'Escape' });
    expect(h.onDeselect).toHaveBeenCalledTimes(1);
  });

  it('accepts a mobile prop without altering desktop default rendering', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected mobile={false} {...h} />);
    // Desktop default still shows the floating action bar.
    expect(getByLabelText('Delete decoration')).not.toBeNull();
  });

  it('ignores key events bubbling from child controls (only the chrome itself handles keys)', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
    // A keydown originating on a child action-bar button must NOT nudge or delete.
    const deleteBtn = getByLabelText('Delete decoration');
    fireEvent.keyDown(deleteBtn, { key: 'ArrowRight' });
    fireEvent.keyDown(deleteBtn, { key: 'Delete' });
    expect(h.onChange).not.toHaveBeenCalled();
    expect(h.onDelete).not.toHaveBeenCalled();
  });

  it('mobile: a sub-threshold pointer move selects but does not move the decoration', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    const surface = getByTestId('decoration-surface-a');
    fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 3, clientY: 2, pointerId: 1 }); // ~3.6px < 6
    fireEvent.pointerUp(surface, { pointerId: 1 });
    expect(h.onChange).not.toHaveBeenCalled();
  });

  it('mobile: a past-threshold pointer move updates position', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    const surface = getByTestId('decoration-surface-a');
    fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 100, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(surface, { pointerId: 1 });
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', xPct: expect.closeTo(0.6, 5), yPx: 130 }),
    );
  });

  it('desktop: moves immediately with no threshold (regression)', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationItem decoration={d} selected {...h} />);
    const surface = getByTestId('decoration-surface-a');
    fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 3, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(surface, { pointerId: 1 });
    expect(h.onChange).toHaveBeenCalled();
  });

  it('mobile: renders four corner resize handles with a >=44px hit area', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    for (const label of ['Resize top-left', 'Resize top-right', 'Resize bottom-left', 'Resize bottom-right']) {
      const handle = getByLabelText(label) as HTMLElement;
      expect(parseInt(handle.style.width, 10)).toBeGreaterThanOrEqual(44);
      expect(parseInt(handle.style.height, 10)).toBeGreaterThanOrEqual(44);
    }
  });

  it('mobile: dragging the bottom-right corner grows width, anchoring top-left', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    const handle = getByLabelText('Resize bottom-right');
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', widthPct: expect.closeTo(0.3, 5), xPct: expect.closeTo(0.5, 5), yPx: 100 }),
    );
  });

  it('mobile: dragging the bottom-left corner grows width, anchoring top-right', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    const handle = getByLabelText('Resize bottom-left');
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: -100, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(h.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', widthPct: expect.closeTo(0.3, 5), xPct: expect.closeTo(0.4, 5) }),
    );
  });

  it('desktop: still renders the single bottom-right resize handle, not the four mobile ones', () => {
    const h = handlers();
    const { getByLabelText, queryByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
    expect(getByLabelText('Resize decoration')).not.toBeNull();
    expect(queryByLabelText('Resize top-left')).toBeNull();
  });

  it('mobile: rotate handle output snaps to the nearest 45 within 5 degrees', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    const handle = getByLabelText('Rotate decoration');
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 7.31, clientY: 6.82, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    const last = h.onChange.mock.calls.at(-1)![0] as NoteDecoration;
    expect(last.rotation).toBe(45);
  });

  it('mobile: shows a live angle badge during a rotate gesture, hidden otherwise', () => {
    const h = handlers();
    const { getByLabelText, queryByTestId, getByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    expect(queryByTestId('decoration-angle-badge-a')).toBeNull();
    const handle = getByLabelText('Rotate decoration');
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 0, clientY: 10, pointerId: 1 });
    expect(getByTestId('decoration-angle-badge-a').textContent).toContain('90');
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(queryByTestId('decoration-angle-badge-a')).toBeNull();
  });

  it('mobile: marks the rotate handle as snapped at a cardinal angle (drives the pulse)', () => {
    const h = handlers();
    const { getByLabelText, getByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    const handle = getByLabelText('Rotate decoration');
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 7.31, clientY: 6.82, pointerId: 1 }); // ~43 -> snaps 45
    expect(getByTestId('decoration-angle-badge-a').getAttribute('data-snapped')).toBe('true');
  });

  it('mobile: two-finger pinch rotation snaps to 45 multiples', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    const surface = getByTestId('decoration-surface-a');
    fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 2 });   // startAngle 0
    fireEvent.pointerMove(surface, { clientX: 73.1, clientY: 68.2, pointerId: 2 }); // ~43deg
    const last = h.onChange.mock.calls.at(-1)![0] as NoteDecoration;
    expect(last.rotation).toBe(45);
  });

  it('mobile: clears the angle badge when a two-finger pinch ends', () => {
    // Regression: pinch-rotate SETS liveAngle during the gesture, but the
    // pinch-end path must clear it so the badge does not stay stranded after
    // both fingers lift.
    const h = handlers();
    const { getByTestId, queryByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    const surface = getByTestId('decoration-surface-a');
    fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 2 });   // startAngle 0
    fireEvent.pointerMove(surface, { clientX: 73.1, clientY: 68.2, pointerId: 2 }); // ~43deg -> badge appears
    expect(getByTestId('decoration-angle-badge-a')).not.toBeNull();
    fireEvent.pointerUp(surface, { pointerId: 2 });
    fireEvent.pointerUp(surface, { pointerId: 1 });
    expect(queryByTestId('decoration-angle-badge-a')).toBeNull();
  });

  it('desktop: rotate handle does NOT snap (regression)', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
    const handle = getByLabelText('Rotate decoration');
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 7.31, clientY: 6.82, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    const last = h.onChange.mock.calls.at(-1)![0] as NoteDecoration;
    expect(last.rotation).toBeCloseTo(43, 0); // ~43, NOT snapped to 45
  });

  it('mobile: does NOT render the floating action bar', () => {
    const h = handlers();
    const { queryByLabelText } = render(<DecorationItem decoration={d} selected mobile {...h} />);
    expect(queryByLabelText('Delete decoration')).toBeNull();
    expect(queryByLabelText('Flip horizontal')).toBeNull();
  });

  it('desktop: still renders the floating action bar (regression)', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
    expect(getByLabelText('Delete decoration')).not.toBeNull();
  });
});
