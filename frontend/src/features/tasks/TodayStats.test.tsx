// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeTask } from '../../test/makeTask';
import { TodayStats } from './TodayStats';

const NOW = new Date(2026, 10, 9, 12);

describe('TodayStats', () => {
  it('shows progress with subtasks, due today, overdue and high priority', () => {
    render(
      <TodayStats
        now={NOW}
        tasks={[
          makeTask({ id: 'today', due_date: '2026-11-09', priority: 3 }),
          makeTask({ id: 'late', due_date: '2026-11-01' }),
          makeTask({
            id: 'done',
            due_date: '2026-11-09',
            completed_at: new Date(2026, 10, 9, 9).toISOString(),
          }),
          makeTask({ id: 'sub', parent_id: 'today', completed_at: '2026-11-09T08:00:00Z' }),
          makeTask({ id: 'later', due_date: '2026-11-20', priority: 3 }),
          makeTask({ id: 'tomorrow', due_date: '2026-11-10' }),
        ]}
      />,
    );
    const region = screen.getByRole('region', { name: 'Итоги дня' });

    expect(within(region).getByText('2 из 4')).toBeInTheDocument();
    expect(within(region).getByText('на сегодня').previousSibling).toHaveTextContent('2');
    expect(within(region).getByText('просрочено').previousSibling).toHaveTextContent('1');
    expect(within(region).getByText('высокий приоритет').previousSibling).toHaveTextContent('1');
    expect(within(region).queryByText('на завтра')).toBeNull();
  });

  it('shows an empty ring for an empty day', () => {
    render(<TodayStats now={NOW} tasks={[]} />);

    expect(screen.getByText('0 из 0')).toBeInTheDocument();
  });
});
