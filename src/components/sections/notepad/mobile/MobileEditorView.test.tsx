// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
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
    const { getByTestId } = render(<MobileEditorView onOpenDetails={vi.fn()} onExit={vi.fn()} />);
    expect(getByTestId('editor').getAttribute('data-placement')).toBe('bottom');
  });

  it('opens details when the ⋯ button is tapped', () => {
    const onOpenDetails = vi.fn();
    const { getByLabelText } = render(<MobileEditorView onOpenDetails={onOpenDetails} onExit={vi.fn()} />);
    fireEvent.click(getByLabelText('Note details'));
    expect(onOpenDetails).toHaveBeenCalledOnce();
  });
});
