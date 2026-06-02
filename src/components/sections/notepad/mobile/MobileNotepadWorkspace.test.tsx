// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const model = {
  user: { id: 'u1' },
  notes: [{ id: 'n1' }],
  activeNote: { id: 'n1' },
  totalNoteCount: 1,
  isOnline: true,
  openNote: vi.fn(),
  createNote: vi.fn(),
  lamplightAdapter: {},
  onAfterSave: vi.fn(),
  loadNeighborNotes: async () => [],
};
vi.mock('./useMobileWorkspaceModel', () => ({ useMobileWorkspaceModel: () => model }));
vi.mock('./useHasConnections', () => ({ useHasConnections: () => false }));
vi.mock('./MobileNotesView', () => ({ MobileNotesView: () => <div data-testid="view-notes" /> }));
vi.mock('./MobileEditorView', () => ({ MobileEditorView: () => <div data-testid="view-editor" /> }));
vi.mock('./LamplightMobileView', () => ({ LamplightMobileView: () => <div data-testid="view-lamplight" /> }));
vi.mock('./MobileMoreSheet', () => ({ MobileMoreSheet: (p: { open: boolean }) => (p.open ? <div data-testid="more-sheet" /> : null) }));
vi.mock('../../../../notepad/components/SearchDialog', () => ({ SearchDialog: () => <div /> }));
vi.mock('../../../../notepad/components/MigrationDialog', () => ({ MigrationDialog: () => <div /> }));
vi.mock('../../../../notepad/first-load/useNotepadFirstLoad', () => ({
  useNotepadFirstLoad: () => ({ showMigration: false, dismissMigration: vi.fn() }),
}));
vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: () => ({ adapter: {}, session: { signOut: vi.fn() } }),
}));
vi.mock('@/auth/context/useAccountProfile', () => ({ useAccountProfile: () => ({ profile: null }) }));
vi.mock('../../../../notepad/context/useNotepadActions', () => ({ useNotepadActions: () => ({ init: vi.fn() }) }));

import { MobileNotepadWorkspace } from './MobileNotepadWorkspace';

afterEach(cleanup);

function renderShell() {
  return render(
    <MemoryRouter>
      <MobileNotepadWorkspace />
    </MemoryRouter>,
  );
}

describe('<MobileNotepadWorkspace />', () => {
  it('starts on the Notes view', () => {
    const { getByTestId } = renderShell();
    expect(getByTestId('view-notes')).toBeTruthy();
  });

  it('switches the visible view when a tab is selected', () => {
    const { getByRole, getByTestId } = renderShell();
    fireEvent.click(getByRole('tab', { name: /Lamplight/ }));
    expect(getByTestId('view-lamplight')).toBeTruthy();
  });

  it('opens the More sheet from the More tab', () => {
    const { getByRole, getByTestId } = renderShell();
    fireEvent.click(getByRole('tab', { name: /More/ }));
    expect(getByTestId('more-sheet')).toBeTruthy();
  });
});
