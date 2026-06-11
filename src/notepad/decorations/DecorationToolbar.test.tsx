// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecorationToolbar } from './DecorationToolbar';
import type { NoteDecoration } from '../types';

const d: NoteDecoration = {
  id: 'a', assetId: 'arrow-01', xPct: 0.5, yPx: 100, widthPct: 0.2, rotation: 0, z: 3,
};

const handlers = () => ({
  decoration: d, bottomOffset: 120,
  onChange: vi.fn(), onDelete: vi.fn(), onDuplicate: vi.fn(),
  onBringToFront: vi.fn(), onSendToBack: vi.fn(), onDone: vi.fn(),
});

afterEach(cleanup);

describe('DecorationToolbar', () => {
  it('renders a bottom-pinned bar at the given offset', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationToolbar {...h} />);
    const bar = getByTestId('decoration-toolbar') as HTMLElement;
    expect(bar.style.position).toBe('sticky');
    expect(bar.style.bottom).toBe('120px');
  });

  it('does NOT render rotate buttons (handle/gesture own rotation)', () => {
    const h = handlers();
    const { queryByLabelText } = render(<DecorationToolbar {...h} />);
    expect(queryByLabelText('Rotate decoration 15 degrees')).toBeNull();
  });

  it('fires flip/layer/duplicate/delete/done callbacks', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationToolbar {...h} />);
    fireEvent.click(getByLabelText('Flip horizontal'));
    expect(h.onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', flipH: true }));
    fireEvent.click(getByLabelText('Flip vertical'));
    expect(h.onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', flipV: true }));
    fireEvent.click(getByLabelText('Bring to front'));
    expect(h.onBringToFront).toHaveBeenCalledWith('a');
    fireEvent.click(getByLabelText('Send to back'));
    expect(h.onSendToBack).toHaveBeenCalledWith('a');
    fireEvent.click(getByLabelText('Duplicate decoration'));
    expect(h.onDuplicate).toHaveBeenCalledWith('a');
    fireEvent.click(getByLabelText('Delete decoration'));
    expect(h.onDelete).toHaveBeenCalledWith('a');
    fireEvent.click(getByLabelText('Done editing decoration'));
    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it('every control meets the 44px touch-target minimum', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationToolbar {...h} />);
    for (const label of ['Flip horizontal', 'Flip vertical', 'Bring to front', 'Send to back', 'Duplicate decoration', 'Delete decoration', 'Done editing decoration']) {
      const btn = getByLabelText(label) as HTMLElement;
      expect(parseInt(btn.style.minWidth || btn.style.width, 10)).toBeGreaterThanOrEqual(44);
      expect(parseInt(btn.style.minHeight || btn.style.height, 10)).toBeGreaterThanOrEqual(44);
    }
  });
});
