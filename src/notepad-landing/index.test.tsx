// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, afterEach } from 'vitest';

afterEach(cleanup);
import { NotepadLanding } from './index';

describe('NotepadLanding (stub)', () => {
  it('renders the locked hero H1', () => {
    render(
      <MemoryRouter initialEntries={['/notepad']}>
        <Routes>
          <Route path="/notepad" element={<NotepadLanding />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /for what you cannot afford to forget/i }),
    ).toBeInTheDocument();
  });

  it('renders the primary CTA that links to /notepad/notes', () => {
    render(
      <MemoryRouter initialEntries={['/notepad']}>
        <Routes>
          <Route path="/notepad" element={<NotepadLanding />} />
        </Routes>
      </MemoryRouter>,
    );
    const cta = screen.getByRole('link', { name: /open your notepad/i });
    expect(cta).toHaveAttribute('href', '/notepad/notes');
  });
});
