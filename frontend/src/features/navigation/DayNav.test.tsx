// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DayNav } from './DayNav';

const TODAY = '2026-11-09';

describe('DayNav', () => {
  it('steps a day back and forward; reaching today clears the day', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<DayNav day={TODAY} today={TODAY} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Следующий день' }));
    await userEvent.click(screen.getByRole('button', { name: 'Предыдущий день' }));
    rerender(<DayNav day="2026-11-10" today={TODAY} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Предыдущий день' }));

    expect(onChange.mock.calls).toEqual([['2026-11-10'], ['2026-11-08'], [null]]);
  });

  it('jumps back to today, and marks it when shown', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<DayNav day="2026-12-31" today={TODAY} onChange={onChange} />);
    const todayButton = screen.getByRole('button', { name: 'Сегодня' });
    expect(todayButton).not.toHaveAttribute('aria-current');

    await userEvent.click(todayButton);
    expect(onChange).toHaveBeenCalledWith(null);

    rerender(<DayNav day={TODAY} today={TODAY} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Сегодня' })).toHaveAttribute('aria-current', 'date');
  });
});
