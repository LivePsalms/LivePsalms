// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminEntryLink } from './AdminEntryLink';

vi.mock('@/admin/hooks/useIsAdmin', () => ({
  useIsAdmin: vi.fn(),
}));

import { useIsAdmin } from '@/admin/hooks/useIsAdmin';

afterEach(cleanup);

describe('AdminEntryLink', () => {
  it('renders nothing while loading', () => {
    (useIsAdmin as ReturnType<typeof vi.fn>).mockReturnValue({ isAdmin: null, loading: true });
    const { container } = render(<MemoryRouter><AdminEntryLink /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for non-admin', () => {
    (useIsAdmin as ReturnType<typeof vi.fn>).mockReturnValue({ isAdmin: false, loading: false });
    const { container } = render(<MemoryRouter><AdminEntryLink /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
  });

  it('renders the link with correct copy + href for admin', () => {
    (useIsAdmin as ReturnType<typeof vi.fn>).mockReturnValue({ isAdmin: true, loading: false });
    render(<MemoryRouter><AdminEntryLink /></MemoryRouter>);
    const link = screen.getByTestId('admin-entry-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/lamplight');
    expect(screen.getByText(/Lamplight Ops/i)).toBeInTheDocument();
    expect(screen.getByText(/Job queue, usage, retries/i)).toBeInTheDocument();
  });
});
