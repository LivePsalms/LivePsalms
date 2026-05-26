// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaywallCard } from './PaywallCard';

afterEach(cleanup);

describe('PaywallCard', () => {
  it('renders the promo-ended copy and a contact link', () => {
    render(<MemoryRouter><PaywallCard /></MemoryRouter>);
    expect(screen.getByText(/lamplight is no longer included free/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact us for access/i })).toHaveAttribute('href', '/contact');
  });
});
