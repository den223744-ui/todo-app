// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { makeList } from '../../test/makeList';
import { makeTask } from '../../test/makeTask';
import { Timeline } from './Timeline';
import { useUiStore } from '../../store/uiStore';

const TODAY = '2026-11-09';
const NOW = new Date(2026, 10, 9, 13, 36);

function renderTimeline(day = TODAY) {
  const onOpen = vi.fn();
  render(
    <Timeline
      day={day}
      today={TODAY}
      now={NOW}
      lists={[makeList({ id: 'work', name: 'Работа' })]}
      tasks={[
        makeTask({
          id: 'plan',
          title: 'Спланировать день',
          due_date: TODAY,
          due_time: '09:00:00',
          duration_minutes: 90,
        }),
        makeTask({
          id: 'sync',
          title: 'Созвон',
          due_date: TODAY,
          due_time: '11:00:00',
          list_id: 'work',
        }),
        makeTask({ id: 'any', title: 'Когда-нибудь сегодня', due_date: TODAY }),
        makeTask({
          id: 'other',
          title: 'Завтрашнее',
          due_date: '2026-11-10',
          due_time: '09:00:00',
        }),
      ]}
      onOpen={onOpen}
    />,
  );
  return { onOpen, region: screen.getByRole('region', { name: 'Таймлайн дня' }) };
}

describe('Timeline', () => {
  it('clears the drag flag if navigation unmounts an active timeline', () => {
    const { unmount } = render(
      <Timeline day={TODAY} today={TODAY} now={NOW} tasks={[]} lists={[]} onOpen={vi.fn()} />,
    );
    useUiStore.setState({ dragging: true });
    unmount();
    expect(useUiStore.getState().dragging).toBe(false);
  });
  it('positions the viewport after tasks arrive and preserves scrolling across time edits', () => {
    const props = { day: TODAY, today: TODAY, now: NOW, lists: [], onOpen: vi.fn() };
    const { container, rerender } = render(<Timeline {...props} tasks={[]} ready={false} />);
    const viewport = container.querySelector<HTMLElement>('[data-timeline-scroll]') as HTMLElement;
    expect(viewport.scrollTop).toBe(8 * 56);
    const early = makeTask({ id: 'early', due_date: TODAY, due_time: '02:00:00' });
    rerender(<Timeline {...props} tasks={[early]} ready />);
    expect(viewport.scrollTop).toBe(2 * 56);
    viewport.scrollTop = 180;
    rerender(<Timeline {...props} tasks={[{ ...early, due_time: '02:15:00' }]} ready />);
    expect(viewport.scrollTop).toBe(180);
    rerender(<Timeline {...props} day="2026-11-10" tasks={[]} ready />);
    expect(viewport.scrollTop).toBe(8 * 56);
  });
  it('shows the day, its timed tasks as blocks and the untimed ones below', () => {
    const { region } = renderTimeline();

    expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent(/^Сегодня · /);
    expect(within(region).getByText('запланировано 1 ч 30 мин')).toBeInTheDocument();
    expect(
      within(region).getByRole('button', { name: /Спланировать день.*1 ч 30 мин/ }),
    ).toBeVisible();
    expect(within(region).getByRole('button', { name: /Созвон.*30 мин/ })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: /Спланировать день\s*09:00/ })).toBeVisible();
    expect(within(region).getByRole('button', { name: /Созвон\s*11:00/ })).toBeInTheDocument();
    expect(
      within(region).getByRole('button', { name: 'Когда-нибудь сегодня' }),
    ).toBeInTheDocument();
    expect(within(region).queryByText('Завтрашнее')).toBeNull();
  });

  it('marks now on today only', () => {
    const { region } = renderTimeline();
    expect(within(region).getByText('13:36')).toBeInTheDocument();
  });

  it('has no now line on another day, and says when nothing is timed', () => {
    const { region } = renderTimeline('2026-11-12');

    expect(within(region).queryByText('13:36')).toBeNull();
    expect(within(region).getByRole('heading', { level: 2 })).not.toHaveTextContent('Сегодня');
    expect(within(region).getByText('На этот день нет задач со временем.')).toBeInTheDocument();
  });

  it('opens a task from its block', async () => {
    const { onOpen, region } = renderTimeline();

    await userEvent.click(within(region).getByRole('button', { name: /Созвон/ }));
    await userEvent.click(within(region).getByRole('button', { name: 'Когда-нибудь сегодня' }));

    expect(onOpen.mock.calls).toEqual([['sync'], ['any']]);
  });

  it('can leave out its own label where a tab above already names it', () => {
    render(
      <Timeline
        day={TODAY}
        today={TODAY}
        now={NOW}
        lists={[]}
        tasks={[]}
        onOpen={vi.fn()}
        showLabel={false}
      />,
    );

    expect(screen.queryByText('Таймлайн')).toBeNull();
  });
});
