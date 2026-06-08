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
});
