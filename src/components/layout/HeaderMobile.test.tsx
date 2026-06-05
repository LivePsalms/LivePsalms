// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { HeaderMobile } from './HeaderMobile';

afterEach(cleanup);

describe('HeaderMobile (stubbed)', () => {
  it('renders nothing — the MobileBottomDock replaces it on mobile', () => {
    const { container } = render(
      <MemoryRouter>
        <HeaderMobile onNavTrigger={vi.fn()} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
