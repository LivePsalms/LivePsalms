// @vitest-environment jsdom
// src/notepad/components/lamplight/chat/ChatMessage.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';

afterEach(cleanup);

describe('ChatMessage', () => {
  it('renders user content', () => {
    render(<ChatMessage role="user" content="What does shepherd mean?" citations={[]} />);
    expect(screen.getByText('What does shepherd mean?')).toBeInTheDocument();
  });

  it('renders an assistant reply with a humanized verse citation chip', () => {
    render(<ChatMessage role="assistant" content="The shepherd gives his life." citations={[{ type: 'verse', ref: 'jhn 10:11' }]} />);
    expect(screen.getByText('The shepherd gives his life.')).toBeInTheDocument();
    expect(screen.getByText('John 10:11')).toBeInTheDocument();
  });
});
