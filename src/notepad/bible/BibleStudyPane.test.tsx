// @vitest-environment jsdom
// src/notepad/bible/BibleStudyPane.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const useAuthSession = vi.fn();
const useLamplightSettings = vi.fn();
const useLamplightEntitlement = vi.fn();
vi.mock('@/auth/context/useAuthSession', () => ({ useAuthSession: () => useAuthSession() }));
vi.mock('@/notepad/hooks/useLamplightSettings', () => ({ useLamplightSettings: () => useLamplightSettings() }));
vi.mock('@/notepad/hooks/useLamplightEntitlement', () => ({ useLamplightEntitlement: () => useLamplightEntitlement() }));
vi.mock('./BibleReader', () => ({ BibleReader: (p: { onPassageChange?: (r: unknown) => void }) => {
  // emit a passage on mount so the chat has a book/chapter
  p.onPassageChange?.({ book: 'jhn', chapter: 10 });
  return <div data-testid="bible-reader">reader</div>;
} }));
vi.mock('@/notepad/components/lamplight/chat/LamplightChat', () => ({ LamplightChat: () => <div data-testid="chat">chat</div> }));
vi.mock('@/notepad/components/lamplight/SignInGate', () => ({ SignInGate: () => <div data-testid="signin">signin</div> }));
vi.mock('@/notepad/components/lamplight/PaywallCard', () => ({ PaywallCard: () => <div data-testid="paywall">paywall</div> }));

import { BibleStudyPane } from './BibleStudyPane';

const adapter = {} as never;
beforeEach(() => {
  useAuthSession.mockReturnValue({ user: { id: 'u1' } });
  useLamplightSettings.mockReturnValue({ isLoading: false, settings: { enabled: true } });
  useLamplightEntitlement.mockReturnValue({ isLoading: false, hasAccess: () => true });
});
afterEach(cleanup);

describe('BibleStudyPane', () => {
  it('always shows the reader; chat is hidden until toggled on', () => {
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    expect(screen.getByTestId('bible-reader')).toBeInTheDocument();
    expect(screen.queryByTestId('chat')).not.toBeInTheDocument();
  });

  it('opens the chat when the entitled user toggles Lamplight on', async () => {
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /lamplight/i }));
    await waitFor(() => expect(screen.getByTestId('chat')).toBeInTheDocument());
  });

  it('shows the paywall (not the chat) when toggled on without entitlement', () => {
    useLamplightEntitlement.mockReturnValue({ isLoading: false, hasAccess: () => false });
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /lamplight/i }));
    expect(screen.getByTestId('paywall')).toBeInTheDocument();
    expect(screen.queryByTestId('chat')).not.toBeInTheDocument();
  });

  it('shows the sign-in gate when toggled on while logged out', () => {
    useAuthSession.mockReturnValue({ user: null });
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /lamplight/i }));
    expect(screen.getByTestId('signin')).toBeInTheDocument();
  });
});
