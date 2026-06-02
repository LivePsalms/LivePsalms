// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../notepad/components/Editor', () => ({
  NotepadEditor: (props: { toolbarPlacement?: string }) => (
    <div data-testid="editor" data-placement={props.toolbarPlacement} />
  ),
}));
vi.mock('./useKeyboardInset', () => ({ useKeyboardInset: () => 0 }));
import { MobileEditorView } from './MobileEditorView';

afterEach(cleanup);

describe('<MobileEditorView />', () => {
  it('renders the editor with bottom toolbar placement', () => {
    render(
      <MobileEditorView onOpenDetails={vi.fn()} onExit={vi.fn()} hasActiveNote onNewNote={vi.fn()} />,
    );
    expect(screen.getByTestId('editor').getAttribute('data-placement')).toBe('bottom');
  });

  it('opens details when the ⋯ button is tapped', () => {
    const onOpenDetails = vi.fn();
    render(
      <MobileEditorView onOpenDetails={onOpenDetails} onExit={vi.fn()} hasActiveNote onNewNote={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText('Note details'));
    expect(onOpenDetails).toHaveBeenCalledOnce();
  });

  it('shows the New note FAB when no note is displayed', () => {
    render(
      <MobileEditorView onOpenDetails={vi.fn()} onExit={vi.fn()} hasActiveNote={false} onNewNote={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument();
  });

  it('hides the New note FAB when a note is displayed', () => {
    render(
      <MobileEditorView onOpenDetails={vi.fn()} onExit={vi.fn()} hasActiveNote onNewNote={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'New note' })).toBeNull();
  });

  it('calls onNewNote when the FAB is tapped in the empty state', () => {
    const onNewNote = vi.fn();
    render(
      <MobileEditorView onOpenDetails={vi.fn()} onExit={vi.fn()} hasActiveNote={false} onNewNote={onNewNote} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    expect(onNewNote).toHaveBeenCalledTimes(1);
  });
});
