// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OptedInPlaceholder } from './OptedInPlaceholder';

afterEach(cleanup);

describe('OptedInPlaceholder', () => {
  it('shows the set-up confirmation and echoes voice + tradition', () => {
    render(
      <MemoryRouter>
        <OptedInPlaceholder voicePreference="Abba" traditionHint="evangelical" />
      </MemoryRouter>
    );
    expect(screen.getByText(/you're set up/i)).toBeInTheDocument();
    expect(screen.getByText(/lamplight will appear here when ready/i)).toBeInTheDocument();
    expect(screen.getByText(/voice: abba/i)).toBeInTheDocument();
    expect(screen.getByText(/tradition: evangelical/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit preferences/i })).toHaveAttribute('href', '/profile');
  });

  it('renders "unspecified" tradition cleanly', () => {
    render(
      <MemoryRouter>
        <OptedInPlaceholder voicePreference="Lord" traditionHint="unspecified" />
      </MemoryRouter>
    );
    expect(screen.getByText(/tradition: unspecified/i)).toBeInTheDocument();
  });
});
