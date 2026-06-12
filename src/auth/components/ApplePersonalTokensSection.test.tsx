// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplePersonalTokensSection } from './ApplePersonalTokensSection';
import * as tokens from '../personal-tokens';

vi.mock('../personal-tokens', async (orig) => {
  const actual = await orig<typeof import('../personal-tokens')>();
  return { ...actual, createToken: vi.fn(), listTokens: vi.fn(), revokeToken: vi.fn() };
});

const client = {} as never;

beforeEach(() => {
  vi.mocked(tokens.listTokens).mockResolvedValue([]);
  vi.mocked(tokens.createToken).mockResolvedValue('psalms_pat_RAWVALUE123');
  vi.mocked(tokens.revokeToken).mockResolvedValue();
});

describe('ApplePersonalTokensSection', () => {
  it('reveals the raw token once after generating', async () => {
    render(<ApplePersonalTokensSection client={client} userId="u-1" />);
    fireEvent.click(screen.getByRole('button', { name: /generate token/i }));
    await waitFor(() => expect(screen.getByText('psalms_pat_RAWVALUE123')).toBeInTheDocument());
    expect(tokens.createToken).toHaveBeenCalledWith(client, 'u-1', expect.any(String));
  });

  it('lists existing tokens and revokes one', async () => {
    vi.mocked(tokens.listTokens).mockResolvedValue([
      { id: 't1', name: 'Apple Notes Shortcut', lastUsedAt: null, createdAt: '2026-06-11T00:00:00Z' },
    ]);
    render(<ApplePersonalTokensSection client={client} userId="u-1" />);
    await waitFor(() => expect(screen.getByText('Apple Notes Shortcut')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));
    expect(tokens.revokeToken).toHaveBeenCalledWith(client, 't1');
  });
});
