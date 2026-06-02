// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LegalPage } from './LegalPage';

afterEach(cleanup);

describe('LegalPage', () => {
  it('renders the title as an h1', () => {
    render(
      <LegalPage title="Privacy Policy" effectiveDate="May 28, 2026" lastUpdated="May 28, 2026">
        <p>body</p>
      </LegalPage>,
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'Privacy Policy' });
    expect(heading).toBeInTheDocument();
  });

  it('renders the effective and last-updated dates', () => {
    render(
      <LegalPage title="Privacy Policy" effectiveDate="May 28, 2026" lastUpdated="May 28, 2026">
        <p>body</p>
      </LegalPage>,
    );
    expect(screen.getByText(/Effective Date/i)).toBeInTheDocument();
    expect(screen.getByText(/Last Updated/i)).toBeInTheDocument();
  });

  it('renders children inside a main landmark with an accessible name', () => {
    render(
      <LegalPage title="Terms & Conditions" effectiveDate="May 28, 2026" lastUpdated="May 28, 2026">
        <p>distinctive-body-text</p>
      </LegalPage>,
    );
    const main = screen.getByRole('main', { name: 'Terms & Conditions' });
    expect(main).toBeInTheDocument();
    expect(screen.getByText('distinctive-body-text')).toBeInTheDocument();
  });

  it('wraps children in a .legal-prose container', () => {
    const { container } = render(
      <LegalPage title="Privacy Policy" effectiveDate="May 28, 2026" lastUpdated="May 28, 2026">
        <p>body</p>
      </LegalPage>,
    );
    expect(container.querySelector('.legal-prose')).not.toBeNull();
  });
});
