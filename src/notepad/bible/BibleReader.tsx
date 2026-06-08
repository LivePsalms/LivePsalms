// src/notepad/bible/BibleReader.tsx
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { bookByAbbrev, OLD_TESTAMENT, NEW_TESTAMENT, type BibleBook } from './bible-books';
import { useBiblePassages } from './useBiblePassages';

export interface PassageRef {
  book: string;
  chapter: number;
}

export interface VerseRef extends PassageRef {
  verse: number;
}

export interface BibleReaderProps {
  initialBook?: string;
  initialChapter?: number;
  /** Fires whenever the displayed book/chapter changes (mount + navigation). */
  onPassageChange?: (ref: PassageRef) => void;
  /** Fires when the user taps a verse (chat focus in Phase 2). */
  onSelectVerse?: (ref: VerseRef) => void;
}

export function BibleReader({
  initialBook = 'jhn',
  initialChapter = 1,
  onPassageChange,
  onSelectVerse,
}: BibleReaderProps) {
  const [book, setBook] = useState(initialBook);
  const [chapter, setChapter] = useState(initialChapter);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);

  const [navOpen, setNavOpen] = useState(false);
  const [navBook, setNavBook] = useState<BibleBook | null>(null);

  const navChapters = useMemo(
    () => (navBook ? Array.from({ length: navBook.chapterCount }, (_, i) => i + 1) : []),
    [navBook],
  );

  const jumpTo = (abbrev: string, ch: number) => {
    setBook(abbrev);
    setChapter(ch);
    setSelectedVerse(null);
    setNavOpen(false);
    setNavBook(null);
  };

  const meta = bookByAbbrev(book);
  const { verses, loading, error } = useBiblePassages(book, chapter);

  useEffect(() => {
    onPassageChange?.({ book, chapter });
  }, [book, chapter, onPassageChange]);

  const goPrev = () => {
    if (chapter > 1) {
      setChapter((c) => c - 1);
      setSelectedVerse(null);
    }
  };
  const goNext = () => {
    if (meta && chapter < meta.chapterCount) {
      setChapter((c) => c + 1);
      setSelectedVerse(null);
    }
  };
  const selectVerse = (verse: number) => {
    setSelectedVerse(verse);
    onSelectVerse?.({ book, chapter, verse });
  };

  const label = `${meta?.name ?? book} ${chapter}`;

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--pale-stone)' }}>
        <button
          aria-label="Browse books"
          onClick={() => { setNavOpen((o) => !o); setNavBook(null); }}
          className="text-[13px] font-bold flex items-center gap-1"
          style={{ color: 'var(--deep-umber)' }}
        >
          {label}
          <span className="text-[9px]" style={{ color: 'var(--silica)' }}>▾</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous chapter"
            onClick={goPrev}
            disabled={chapter <= 1}
            className="p-1.5 rounded hover:bg-black/5 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
          </button>
          <button
            aria-label="Next chapter"
            onClick={goNext}
            disabled={!meta || chapter >= meta.chapterCount}
            className="p-1.5 rounded hover:bg-black/5 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
          </button>
        </div>
      </div>

      {navOpen && (
        <div className="px-4 py-3 shrink-0 overflow-y-auto" style={{ borderBottom: '1px solid var(--pale-stone)', maxHeight: '50%' }}>
          {!navBook && (
            <>
              <NavSection title="Old Testament" books={OLD_TESTAMENT} onPick={setNavBook} />
              <NavSection title="New Testament" books={NEW_TESTAMENT} onPick={setNavBook} />
            </>
          )}
          {navBook && (
            <div>
              <button
                onClick={() => setNavBook(null)}
                className="text-[10px] font-medium tracking-wider mb-2 flex items-center gap-1"
                style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
              >
                <ChevronLeft className="w-3 h-3" /> {navBook.name}
              </button>
              <div className="grid grid-cols-8 gap-1.5">
                {navChapters.map((ch) => (
                  <button
                    key={ch}
                    aria-label={`Chapter ${ch}`}
                    onClick={() => jumpTo(navBook.abbrev, ch)}
                    className="text-[10px] py-1 rounded text-center hover:bg-black/5"
                    style={{ border: '1px solid var(--pale-stone)', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* body */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ fontFamily: 'Georgia, serif' }}>
        {loading && (
          <p className="text-[11px] tracking-wider" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            Loading passage…
          </p>
        )}
        {error && !loading && (
          <p className="text-[11px] tracking-wider" style={{ color: '#b45454', fontFamily: 'Outfit, sans-serif' }}>
            {error}
          </p>
        )}
        {!loading && !error && verses.length === 0 && (
          <p className="text-[11px] tracking-wider" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            No text found for this chapter.
          </p>
        )}
        {!loading && !error && verses.length > 0 && (
          <p className="text-[13px] leading-[1.9]" style={{ color: 'var(--deep-umber)' }}>
            {verses.map((v) => (
              <span
                key={v.verse}
                onClick={() => selectVerse(v.verse)}
                className="cursor-pointer"
                style={{
                  background: selectedVerse === v.verse ? 'rgba(196,154,120,0.22)' : 'transparent',
                  borderRadius: 3,
                  padding: '0 2px',
                }}
              >
                <sup className="text-[9px] font-bold mr-1" style={{ color: '#C49A78' }}>{v.verse}</sup>
                {v.text}{' '}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

function NavSection({ title, books, onPick }: { title: string; books: readonly BibleBook[]; onPick: (b: BibleBook) => void }) {
  return (
    <div className="mb-3">
      <div className="text-[9px] font-semibold tracking-[0.16em] mb-1.5" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
        {title.toUpperCase()}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {books.map((b) => (
          <button
            key={b.abbrev}
            onClick={() => onPick(b)}
            className="text-[10px] px-2 py-1 rounded hover:bg-black/5"
            style={{ border: '1px solid var(--pale-stone)', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
