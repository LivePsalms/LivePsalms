// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Terms } from './Terms';

afterEach(cleanup);

describe('Terms', () => {
  it('renders the page title', () => {
    render(<Terms />);
    expect(screen.getByRole('heading', { level: 1, name: /Terms (&|and) Conditions/i })).toBeInTheDocument();
  });

  it('uses support@ for account-security contact and never security@', () => {
    const { container } = render(<Terms />);
    const text = container.textContent ?? '';
    expect(text).toContain('support@livepsalms.com');
    expect(text).not.toContain('security@livepsalms.com');
  });

  it('keeps legal@ for DMCA / disputes', () => {
    const { container } = render(<Terms />);
    expect(container.textContent ?? '').toContain('legal@livepsalms.com');
  });

  it('shows real address + phone and no bracket placeholders', () => {
    const { container } = render(<Terms />);
    const text = container.textContent ?? '';
    expect(text).toContain('17130 Van Buren Blvd, Unit 855, Riverside, CA 92504');
    expect(text).toContain('+1 (818) 800-4075');
    expect(text).not.toContain('[Your Address]');
    expect(text).not.toContain('[Your Phone Number]');
  });

  it('does not include the internal Manus AI author line', () => {
    const { container } = render(<Terms />);
    expect(container.textContent ?? '').not.toContain('Manus AI');
  });

  it('renders a major section heading from the document', () => {
    render(<Terms />);
    expect(screen.getByRole('heading', { name: /Acceptable Use Policy/i })).toBeInTheDocument();
  });
});
