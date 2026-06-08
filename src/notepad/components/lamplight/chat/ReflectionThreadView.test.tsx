// @vitest-environment jsdom
// src/notepad/components/lamplight/chat/ReflectionThreadView.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock ref wrapped in vi.hoisted so it is initialized before the hoisted
// vi.mock() factory runs (matches the convention in useChatThread.test.ts).
const { useThreadMessages } = vi.hoisted(() => ({ useThreadMessages: vi.fn() }));
vi.mock('@/notepad/bible/useThreadMessages', () => ({ useThreadMessages: (...a: unknown[]) => useThreadMessages(...a) }));

import { ReflectionThreadView } from './ReflectionThreadView';

afterEach(cleanup);

describe('ReflectionThreadView', () => {
  it('renders the thread messages read-only with no input box', () => {
    useThreadMessages.mockReturnValue({
      loading: false, error: null,
      messages: [
        { id: 'm1', role: 'user', content: 'What is the gate?', citations: [] },
        { id: 'm2', role: 'assistant', content: 'Christ is the gate.', citations: [] },
      ],
    });
    render(<ReflectionThreadView threadId="t1" onBack={vi.fn()} />);
    expect(screen.getByText('What is the gate?')).toBeInTheDocument();
    expect(screen.getByText('Christ is the gate.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ask about this passage/i)).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it('calls onBack', () => {
    useThreadMessages.mockReturnValue({ loading: false, error: null, messages: [] });
    const onBack = vi.fn();
    render(<ReflectionThreadView threadId="t1" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back to history/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
