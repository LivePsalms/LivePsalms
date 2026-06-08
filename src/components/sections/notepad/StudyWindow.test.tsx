// @vitest-environment jsdom
// src/components/sections/notepad/StudyWindow.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('./GraphPane', () => ({ GraphPane: () => <div data-testid="graph-pane">graph</div> }));
vi.mock('@/notepad/bible/BibleStudyPane', () => ({ BibleStudyPane: () => <div data-testid="bible-study">bible</div> }));

import { StudyWindow } from './StudyWindow';

afterEach(cleanup);

describe('StudyWindow', () => {
  it('defaults to the Bible tab', () => {
    render(<StudyWindow graphOpen={true} lamplightAdapter={null} invoke={vi.fn()} />);
    expect(screen.getByTestId('bible-study')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-pane')).not.toBeInTheDocument();
  });

  it('renders Bible tab before Graph tab', () => {
    render(<StudyWindow graphOpen={true} lamplightAdapter={null} invoke={vi.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveTextContent(/bible/i);
    expect(tabs[1]).toHaveTextContent(/graph/i);
  });

  it('switches to the Graph tab on click', () => {
    render(<StudyWindow graphOpen={true} lamplightAdapter={null} invoke={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: /graph/i }));
    expect(screen.getByTestId('graph-pane')).toBeInTheDocument();
    expect(screen.queryByTestId('bible-study')).not.toBeInTheDocument();
  });
});
