// @vitest-environment jsdom
// src/notepad/bible/BibleReader.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const useBiblePassages = vi.fn();
vi.mock('./useBiblePassages', () => ({ useBiblePassages: (...a: unknown[]) => useBiblePassages(...a) }));

import { BibleReader } from './BibleReader';

beforeEach(() => {
  useBiblePassages.mockReset();
  useBiblePassages.mockReturnValue({
    loading: false,
    error: null,
    verses: [
      { verse: 1, text: 'In the beginning was the Word' },
      { verse: 2, text: 'He was with God in the beginning' },
    ],
  });
});
afterEach(cleanup);

describe('BibleReader', () => {
  it('renders the current passage heading and verses', () => {
    render(<BibleReader initialBook="jhn" initialChapter={1} />);
    expect(screen.getByText('John 1')).toBeInTheDocument();
    expect(screen.getByText(/In the beginning was the Word/)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // verse number
  });

  it('advances to the next chapter and reports the passage change', () => {
    const onPassageChange = vi.fn();
    render(<BibleReader initialBook="jhn" initialChapter={1} onPassageChange={onPassageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /next chapter/i }));
    expect(screen.getByText('John 2')).toBeInTheDocument();
    expect(onPassageChange).toHaveBeenLastCalledWith({ book: 'jhn', chapter: 2 });
  });

  it('disables previous at chapter 1 and reports verse selection', () => {
    const onSelectVerse = vi.fn();
    render(<BibleReader initialBook="jhn" initialChapter={1} onSelectVerse={onSelectVerse} />);
    expect(screen.getByRole('button', { name: /previous chapter/i })).toBeDisabled();
    fireEvent.click(screen.getByText(/In the beginning was the Word/));
    expect(onSelectVerse).toHaveBeenLastCalledWith({ book: 'jhn', chapter: 1, verse: 1 });
  });

  it('shows a loading state', () => {
    useBiblePassages.mockReturnValue({ loading: true, error: null, verses: [] });
    render(<BibleReader initialBook="jhn" initialChapter={1} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('opens the navigator and jumps to a chosen book + chapter', () => {
    const onPassageChange = vi.fn();
    render(<BibleReader initialBook="jhn" initialChapter={1} onPassageChange={onPassageChange} />);

    // Open navigator via the heading button.
    fireEvent.click(screen.getByRole('button', { name: /browse books/i }));

    // Pick a book (Genesis) then chapter 3.
    fireEvent.click(screen.getByRole('button', { name: /^Genesis$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^chapter 3$/i }));

    expect(screen.getByText('Genesis 3')).toBeInTheDocument();
    expect(onPassageChange).toHaveBeenLastCalledWith({ book: 'gen', chapter: 3 });
  });

  it('filters the book list as you type in the search bar', () => {
    render(<BibleReader initialBook="jhn" initialChapter={1} />);
    fireEvent.click(screen.getByRole('button', { name: /browse books/i }));

    const search = screen.getByLabelText(/search books or verse/i);
    fireEvent.change(search, { target: { value: 'Samuel' } });

    // "Samuel" surfaces the numbered books without typing the number.
    expect(screen.getByRole('button', { name: /^1 Samuel$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^2 Samuel$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Genesis$/ })).not.toBeInTheDocument();
  });

  it('offers a "Go to" jump for a typed verse reference and follows it', () => {
    const onPassageChange = vi.fn();
    render(<BibleReader initialBook="jhn" initialChapter={1} onPassageChange={onPassageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /browse books/i }));

    fireEvent.change(screen.getByLabelText(/search books or verse/i), {
      target: { value: 'Genesis 3:5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /go to genesis 3:5/i }));

    expect(screen.getByText('Genesis 3')).toBeInTheDocument();
    expect(onPassageChange).toHaveBeenLastCalledWith({ book: 'gen', chapter: 3 });
  });
});
