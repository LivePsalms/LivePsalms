// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PrivacyPolicy } from './PrivacyPolicy';

afterEach(cleanup);

describe('PrivacyPolicy', () => {
  it('renders the page title', () => {
    render(<PrivacyPolicy />);
    expect(screen.getByRole('heading', { level: 1, name: /Privacy Policy/i })).toBeInTheDocument();
  });

  it('uses the support@ email and never the old privacy@/security@ addresses', () => {
    const { container } = render(<PrivacyPolicy />);
    const text = container.textContent ?? '';
    expect(text).toContain('support@livepsalms.com');
    expect(text).not.toContain('privacy@livepsalms.com');
    expect(text).not.toContain('security@livepsalms.com');
  });

  it('shows the real mailing address and no bracket placeholders', () => {
    const { container } = render(<PrivacyPolicy />);
    const text = container.textContent ?? '';
    expect(text).toContain('17130 Van Buren Blvd, Unit 855, Riverside, CA 92504');
    expect(text).not.toContain('[Your Address]');
    expect(text).not.toContain('[City, State, ZIP]');
  });

  it('renders at least one scrollable table wrapper', () => {
    const { container } = render(<PrivacyPolicy />);
    expect(container.querySelector('.table-wrap table')).not.toBeNull();
  });

  it('contains a major section heading from the document', () => {
    render(<PrivacyPolicy />);
    expect(screen.getByRole('heading', { name: /How We Share Your Information/i })).toBeInTheDocument();
  });
});
