// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { NodePeek } from './NodePeek';
import type { PeekData } from './node-peek-data';

afterEach(cleanup);

const noteData: PeekData = {
  kind: 'note',
  id: 'n1',
  title: 'Shepherd',
  noteType: 'devotion',
  connectionCount: 3,
  preview: 'The Lord is my shepherd',
  linkedVerses: [{ id: 'scripture:ps-23-1', label: 'Psalm 23:1' }],
};

const scriptureData: PeekData = {
  kind: 'scripture',
  id: 'scripture:ps-23-1',
  reference: 'Psalm 23:1',
  translation: 'WEB',
  text: 'Yahweh is my shepherd; I shall lack nothing.',
  referencedBy: [{ id: 'n1', title: 'Shepherd', type: 'devotion' }],
};

function setup(data: PeekData) {
  const onBack = vi.fn(), onOpenInEditor = vi.fn(), onFocus = vi.fn(), onPeekNote = vi.fn();
  render(<NodePeek data={data} onBack={onBack} onOpenInEditor={onOpenInEditor} onFocus={onFocus} onPeekNote={onPeekNote} />);
  return { onBack, onOpenInEditor, onFocus, onPeekNote };
}

describe('<NodePeek /> — note', () => {
  it('shows title, preview, and a linked verse', () => {
    setup(noteData);
    expect(screen.getByText('Shepherd')).toBeTruthy();
    expect(screen.getByText('The Lord is my shepherd')).toBeTruthy();
    expect(screen.getByText('Psalm 23:1')).toBeTruthy();
  });

  it('Open in Editor fires onOpenInEditor with the note id', () => {
    const { onOpenInEditor } = setup(noteData);
    fireEvent.click(screen.getByRole('button', { name: /open in editor/i }));
    expect(onOpenInEditor).toHaveBeenCalledWith('n1');
  });

  it('Focus fires onFocus with the note id; Back fires onBack', () => {
    const { onFocus, onBack } = setup(noteData);
    fireEvent.click(screen.getByRole('button', { name: /focus in graph/i }));
    expect(onFocus).toHaveBeenCalledWith('n1');
    fireEvent.click(screen.getByRole('button', { name: /back to graph/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('<NodePeek /> — scripture', () => {
  it('shows reference, translation, verse text, and referenced-by notes', () => {
    setup(scriptureData);
    expect(screen.getByText('Psalm 23:1')).toBeTruthy();
    expect(screen.getByText(/WEB/)).toBeTruthy();
    expect(screen.getByText(/Yahweh is my shepherd/)).toBeTruthy();
    expect(screen.getByText('Shepherd')).toBeTruthy();
  });

  it('tapping a referenced note fires onPeekNote; no Open in Editor button', () => {
    const { onPeekNote } = setup(scriptureData);
    expect(screen.queryByRole('button', { name: /open in editor/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Shepherd/ }));
    expect(onPeekNote).toHaveBeenCalledWith('n1');
  });
});
