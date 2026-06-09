// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { SecuritySection } from './SecuritySection';

afterEach(() => cleanup());

const styles = { sectionStyle: {}, labelStyle: {} };

describe('SecuritySection', () => {
  it('renders a working Change Password button for email users', () => {
    const onChangePassword = vi.fn();
    render(
      <SecuritySection providers={['email']} onChangePassword={onChangePassword} {...styles} />
    );
    const btn = screen.getByTestId('security-change-password');
    fireEvent.click(btn);
    expect(onChangePassword).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('security-password-managed')).toBeNull();
  });

  it('renders a disabled managed-by row for Google-only users', () => {
    render(
      <SecuritySection providers={['google']} onChangePassword={vi.fn()} {...styles} />
    );
    expect(screen.queryByTestId('security-change-password')).toBeNull();
    const managed = screen.getByTestId('security-password-managed');
    expect(managed.textContent).toMatch(/managed by your Google account/i);
  });

  it('shows Apple wording for Apple-only users', () => {
    render(
      <SecuritySection providers={['apple']} onChangePassword={vi.fn()} {...styles} />
    );
    expect(screen.getByTestId('security-password-managed').textContent)
      .toMatch(/managed by your Apple account/i);
  });

  it('shows generic managed wording for unrecognized provider', () => {
    render(<SecuritySection providers={[]} onChangePassword={vi.fn()} {...styles} />);
    expect(screen.getByTestId('security-password-managed').textContent)
      .toMatch(/managed by your linked account/i);
  });

  it('shows linked status for each provider', () => {
    render(
      <SecuritySection providers={['email', 'google']} onChangePassword={vi.fn()} {...styles} />
    );
    expect(screen.getByTestId('security-google').textContent).toMatch(/Linked/);
    expect(screen.getByTestId('security-apple').textContent).toMatch(/Not linked/);
  });
});
