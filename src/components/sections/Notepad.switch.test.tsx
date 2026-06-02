// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const isMobile = { value: false };
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => isMobile.value }));
vi.mock('./notepad/mobile/MobileNotepadWorkspace', () => ({
  MobileNotepadWorkspace: () => <div data-testid="mobile-shell" />,
}));
// Stand in for the (heavy) desktop body so this test stays focused on the switch.
vi.mock('@/notepad/context/NotepadProvider', () => ({
  NotepadProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/auth/context/useAuthSession', () => ({ useAuthSession: () => ({ adapter: {} }) }));

// The desktop body reads many hooks; mock the workspace's own module boundary by
// mocking the leaf imports it pulls. Simplest: assert via the mobile path and a
// sentinel for desktop using a spy on the rendered marker the desktop path emits.

import { Notepad } from './Notepad';

afterEach(cleanup);

describe('Notepad breakpoint switch', () => {
  it('renders the mobile shell when useIsMobile() is true', () => {
    isMobile.value = true;
    const { getByTestId } = render(<Notepad />);
    expect(getByTestId('mobile-shell')).toBeTruthy();
  });
});
