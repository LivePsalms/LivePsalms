// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PasswordChecklist } from './PasswordChecklist';

afterEach(cleanup);

describe('PasswordChecklist', () => {
  it('marks all five rules met for a strong password', () => {
    render(<PasswordChecklist password="Secret1!" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items.every((li) => li.getAttribute('data-met') === 'true')).toBe(true);
  });

  it('marks only the lowercase rule met for "abc"', () => {
    render(<PasswordChecklist password="abc" />);
    const items = screen.getAllByRole('listitem');
    const metCount = items.filter((li) => li.getAttribute('data-met') === 'true').length;
    expect(metCount).toBe(1);
  });
});
