// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Segmented } from './Segmented';

afterEach(cleanup);

describe('<Segmented />', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Bravo' },
  ];

  it('renders one button per option and marks the selected one pressed', () => {
    const { getByRole } = render(
      <Segmented options={options} value="a" onChange={() => {}} />,
    );
    expect(getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe('true');
    expect(getByRole('button', { name: 'Bravo' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the option value when a segment is clicked', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Segmented options={options} value="a" onChange={onChange} />,
    );
    fireEvent.click(getByRole('button', { name: 'Bravo' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
