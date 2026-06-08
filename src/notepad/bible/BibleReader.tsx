// src/notepad/bible/BibleReader.tsx
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { bookByAbbrev } from './bible-books';
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
  const book = initialBook;
  const [chapter, setChapter] = useState(initialChapter);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);

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
        <span className="text-[13px] font-bold" style={{ color: 'var(--deep-umber)' }}>{label}</span>
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
