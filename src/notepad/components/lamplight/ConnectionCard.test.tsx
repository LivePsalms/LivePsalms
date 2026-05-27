// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConnectionCard } from './ConnectionCard';
import type { ConnectionCard as ConnectionCardData } from '../../hooks/useConnectionCards';

afterEach(cleanup);

function baseCard(over: Partial<ConnectionCardData> = {}): ConnectionCardData {
  return {
    relatedNoteId: 'note-2',
    relatedNoteTitle: 'On wilderness',
    similarity: 0.91,
    sharedTags: ['wilderness'],
    sharedVerseRefs: ['Psalm 23:4'],
    why: { phase: 'collapsed' },
    ...over,
  };
}

describe('ConnectionCard', () => {
  it('renders title and signal pills when collapsed', () => {
    render(
      <ConnectionCard
        card={baseCard()}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(screen.getByText('On wilderness')).toBeInTheDocument();
    expect(screen.getByText('#wilderness')).toBeInTheDocument();
    expect(screen.getByText('Psalm 23:4')).toBeInTheDocument();
  });

  it('chevron click invokes onExpand', () => {
    const onExpand = vi.fn();
    render(
      <ConnectionCard
        card={baseCard()}
        onExpand={onExpand}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand card/i }));
    expect(onExpand).toHaveBeenCalledWith('note-2');
  });

  it('title click invokes onOpenNote, not onExpand', () => {
    const onExpand = vi.fn();
    const onOpenNote = vi.fn();
    render(
      <ConnectionCard
        card={baseCard()}
        onExpand={onExpand}
        onRetry={() => {}}
        onOpenNote={onOpenNote}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open note: on wilderness/i }));
    expect(onOpenNote).toHaveBeenCalledWith('note-2');
    expect(onExpand).not.toHaveBeenCalled();
  });

  it('renders loading state inside expanded area', () => {
    render(
      <ConnectionCard
        card={baseCard({ why: { phase: 'loading' } })}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the why string when shown', () => {
    render(
      <ConnectionCard
        card={baseCard({
          why: { phase: 'shown', text: 'They both return to wilderness.', cached: false },
        })}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(screen.getByText('They both return to wilderness.')).toBeInTheDocument();
  });

  it('renders retry on error and calls onRetry', () => {
    const onRetry = vi.fn();
    render(
      <ConnectionCard
        card={baseCard({ why: { phase: 'error', reason: 'validators_failed' } })}
        onExpand={() => {}}
        onRetry={onRetry}
        onOpenNote={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/Try again/i));
    expect(onRetry).toHaveBeenCalledWith('note-2');
  });

  it('aria-expanded reflects state', () => {
    const { rerender } = render(
      <ConnectionCard
        card={baseCard()}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /expand card/i }).getAttribute('aria-expanded'),
    ).toBe('false');
    rerender(
      <ConnectionCard
        card={baseCard({ why: { phase: 'shown', text: 'x', cached: true } })}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /collapse card/i }).getAttribute('aria-expanded'),
    ).toBe('true');
  });
});
