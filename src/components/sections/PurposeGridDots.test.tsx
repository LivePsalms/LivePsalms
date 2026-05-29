// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { PurposeGridDots } from './PurposeGridDots';

afterEach(cleanup);

describe('PurposeGridDots', () => {
  const projects = [
    { id: 'a', name: 'Aleph' },
    { id: 'b', name: 'Beth' },
    { id: 'c', name: 'Gimel' },
  ];

  it('renders one dot per project', () => {
    render(<PurposeGridDots projects={projects} activeId="a" />);
    expect(screen.getAllByRole('presentation', { hidden: true })).toHaveLength(3);
  });

  it('marks the dot whose id matches activeId as active', () => {
    render(<PurposeGridDots projects={projects} activeId="b" />);
    const dots = screen.getAllByRole('presentation', { hidden: true });
    expect(dots[0].getAttribute('data-active')).toBe('false');
    expect(dots[1].getAttribute('data-active')).toBe('true');
    expect(dots[2].getAttribute('data-active')).toBe('false');
  });

  it('renders all dots as inactive when activeId is null', () => {
    render(<PurposeGridDots projects={projects} activeId={null} />);
    const dots = screen.getAllByRole('presentation', { hidden: true });
    expect(dots.every((d) => d.getAttribute('data-active') === 'false')).toBe(true);
  });
});
