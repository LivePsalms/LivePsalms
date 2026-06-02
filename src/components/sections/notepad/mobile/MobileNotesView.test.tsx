// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../notepad/components/Sidebar', () => ({
  NotepadSidebar: () => <div data-testid="sidebar" />,
}));
import { MobileNotesView } from './MobileNotesView';

afterEach(cleanup);

describe('<MobileNotesView />', () => {
  const props = {
    onExit: vi.fn(),
    onOpenSearch: vi.fn(),
    onNewNote: vi.fn(),
    onOpenNote: vi.fn(),
  };

  it('renders the sidebar and the new-note FAB', () => {
    const { getByTestId, getByLabelText } = render(<MobileNotesView {...props} />);
    expect(getByTestId('sidebar')).toBeTruthy();
    expect(getByLabelText('New note')).toBeTruthy();
  });

  it('wires exit, search, and new-note actions', () => {
    const onExit = vi.fn();
    const onOpenSearch = vi.fn();
    const onNewNote = vi.fn();
    const { getByLabelText } = render(
      <MobileNotesView {...props} onExit={onExit} onOpenSearch={onOpenSearch} onNewNote={onNewNote} />,
    );
    fireEvent.click(getByLabelText('Back to Psalms'));
    fireEvent.click(getByLabelText('Search notes'));
    fireEvent.click(getByLabelText('New note'));
    expect(onExit).toHaveBeenCalledOnce();
    expect(onOpenSearch).toHaveBeenCalledOnce();
    expect(onNewNote).toHaveBeenCalledOnce();
  });
});
