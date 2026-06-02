// @vitest-environment jsdom
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { MobileFabMenu } from './MobileFabMenu';

function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('reduce') ? reduced : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => cleanup());

describe('MobileFabMenu', () => {
  beforeEach(() => setReducedMotion(false));

  it('hides the options until the trigger is tapped', () => {
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={vi.fn()} />);
    expect(screen.queryByLabelText('New note')).toBeNull();
    const trigger = screen.getByLabelText('New note menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('reveals both options and sets aria-expanded when tapped', () => {
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('New note menu'));
    expect(screen.getByLabelText('New note')).not.toBeNull();
    expect(screen.getByLabelText('Upload note')).not.toBeNull();
    expect(screen.getByLabelText('Close menu').getAttribute('aria-expanded')).toBe('true');
  });

  it('fires onNewNote and closes when New note is chosen', () => {
    const onNewNote = vi.fn();
    render(<MobileFabMenu onNewNote={onNewNote} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('New note menu'));
    fireEvent.click(screen.getByLabelText('New note'));
    expect(onNewNote).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('New note menu').getAttribute('aria-expanded')).toBe('false');
  });

  it('fires onUploadFiles with the selected files', () => {
    const onUploadFiles = vi.fn();
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={onUploadFiles} />);
    const input = screen.getByTestId('fab-file-input') as HTMLInputElement;
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUploadFiles).toHaveBeenCalledTimes(1);
    expect(onUploadFiles.mock.calls[0][0]).toEqual([file]);
  });

  it('closes when the backdrop is tapped', () => {
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('New note menu'));
    fireEvent.click(screen.getByTestId('fab-backdrop'));
    expect(screen.getByLabelText('New note menu').getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when Escape is pressed', () => {
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('New note menu'));
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.getByLabelText('New note menu').getAttribute('aria-expanded')).toBe('false');
  });

  it('renders both options under prefers-reduced-motion', () => {
    setReducedMotion(true);
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('New note menu'));
    expect(screen.getByLabelText('New note')).not.toBeNull();
    expect(screen.getByLabelText('Upload note')).not.toBeNull();
  });
});
