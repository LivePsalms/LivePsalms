// @vitest-environment jsdom
// src/notepad/components/lamplight/chat/ChatHistoryList.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ChatHistoryList } from './ChatHistoryList';

afterEach(cleanup);

const threads = [
  { id: 't2', title: 'On the gate', created_at: '2026-06-02T00:00:00Z', archived: false },
  { id: 't1', title: 'Study of John 10', created_at: '2026-06-01T00:00:00Z', archived: true },
];

describe('ChatHistoryList', () => {
  it('shows an empty state when there are no threads', () => {
    render(<ChatHistoryList threads={[]} loading={false} onSelect={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/no past reflections/i)).toBeInTheDocument();
  });

  it('labels the active thread Current and the rest Past, and selects on click', () => {
    const onSelect = vi.fn();
    render(<ChatHistoryList threads={threads} loading={false} onSelect={onSelect} onBack={vi.fn()} />);
    expect(screen.getByText('On the gate')).toBeInTheDocument();
    // Exact strings target the badge spans only — a loose /current/i would also
    // match the "Back to current" control, which the onBack test requires verbatim.
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Past')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Study of John 10'));
    expect(onSelect).toHaveBeenCalledWith('t1');
  });

  it('calls onBack from the back control', () => {
    const onBack = vi.fn();
    render(<ChatHistoryList threads={threads} loading={false} onSelect={vi.fn()} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back to current/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
