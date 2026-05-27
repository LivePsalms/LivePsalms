// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ConnectionCardsSection } from './ConnectionCardsSection';
import type { ConnectionCard as ConnectionCardData } from '../../hooks/useConnectionCards';

afterEach(cleanup);

function card(id: string): ConnectionCardData {
  return {
    relatedNoteId: id,
    relatedNoteTitle: `Note ${id}`,
    similarity: 0.9,
    sharedTags: [],
    sharedVerseRefs: [],
    why: { phase: 'collapsed' },
  };
}

describe('ConnectionCardsSection', () => {
  it('renders section header', () => {
    render(
      <ConnectionCardsSection
        cards={[card('a')]}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(screen.getByText(/Connections/i)).toBeInTheDocument();
  });

  it('renders 1 card', () => {
    render(
      <ConnectionCardsSection
        cards={[card('a')]}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(screen.getByText('Note a')).toBeInTheDocument();
  });

  it('renders 3 cards', () => {
    render(
      <ConnectionCardsSection
        cards={[card('a'), card('b'), card('c')]}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(screen.getByText('Note a')).toBeInTheDocument();
    expect(screen.getByText('Note b')).toBeInTheDocument();
    expect(screen.getByText('Note c')).toBeInTheDocument();
  });
});
