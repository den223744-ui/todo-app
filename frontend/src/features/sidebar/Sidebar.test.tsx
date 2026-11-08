// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { TaskRead } from '../../api/schema';
import { DEFAULT_LOCATION, type AppLocation } from '../../domain/view';
import { makeTask } from '../../test/makeTask';
import { Sidebar } from './Sidebar';

const NOW = new Date(2026, 10, 9, 10, 0);
const TASKS: TaskRead[] = [
  makeTask({ id: 'inbox-1', tags: ['дом'] }),
  makeTask({ id: 'inbox-2', tags: ['работа', 'дом'] }),
  makeTask({ id: 'today', due_date: '2026-11-09' }),
  makeTask({ id: 'overdue', due_date: '2026-11-01' }),
  makeTask({ id: 'later', due_date: '2026-12-01' }),
  makeTask({ id: 'done', completed_at: '2026-11-08T10:00:00Z', tags: ['старое'] }),
];

function renderSidebar(overrides: { tasks?: TaskRead[] | undefined; location?: AppLocation } = {}) {
  const onNavigate = vi.fn();
  const props = {
    tasks: 'tasks' in overrides ? overrides.tasks : TASKS,
    location: overrides.location ?? DEFAULT_LOCATION,
  };
  render(
    <Sidebar tasks={props.tasks} now={NOW} location={props.location} onNavigate={onNavigate} />,
  );
  return { onNavigate };
}

const listsNav = () => screen.getByRole('navigation', { name: 'Списки' });
const tagsNav = () => screen.getByRole('navigation', { name: 'Теги' });

describe('Sidebar', () => {
  it('shows every smart list with its count; completed has none', () => {
    renderSidebar();
    const links = within(listsNav()).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Сегодня2', // today + overdue
      'Входящие2',
      'Предстоящие1',
      'Просроченные1',
      'Выполненные',
    ]);
  });

  it('marks the overdue count as urgent', () => {
    renderSidebar();
    const overdue = within(listsNav()).getByRole('link', { name: /Просроченные/ });

    expect(within(overdue).getByText('1')).toHaveClass('text-danger');
  });

  it('marks the active view from the URL', () => {
    renderSidebar({ location: { ...DEFAULT_LOCATION, view: { kind: 'list', list: 'upcoming' } } });

    expect(screen.getByRole('link', { name: /Предстоящие/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /Сегодня/ })).not.toHaveAttribute('aria-current');
  });

  it('links to each view, keeping the search and closing the open task', () => {
    renderSidebar({
      location: { view: { kind: 'list', list: 'inbox' }, query: 'хлеб', taskId: 't1' },
    });

    expect(screen.getByRole('link', { name: /Предстоящие/ })).toHaveAttribute(
      'href',
      '?list=upcoming&q=%D1%85%D0%BB%D0%B5%D0%B1',
    );
    expect(screen.getByRole('link', { name: /дом/ })).toHaveAttribute(
      'href',
      '?tag=%D0%B4%D0%BE%D0%BC&q=%D1%85%D0%BB%D0%B5%D0%B1',
    );
  });

  it('links the default view to the root', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: /Сегодня/ })).toHaveAttribute('href', '/');
  });

  it('navigates in place on a plain click', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderSidebar();

    await user.click(screen.getByRole('link', { name: /Входящие/ }));
    await user.click(screen.getByRole('link', { name: /работа/ }));

    expect(onNavigate.mock.calls).toEqual([
      [{ kind: 'list', list: 'inbox' }],
      [{ kind: 'tag', tag: 'работа' }],
    ]);
  });

  it.each([
    ['ctrlKey', { ctrlKey: true }],
    ['metaKey', { metaKey: true }],
    ['shiftKey', { shiftKey: true }],
    ['altKey', { altKey: true }],
    ['middle button', { button: 1 }],
  ])('leaves a %s click to the browser (new tab)', (_name, init) => {
    const { onNavigate } = renderSidebar();
    const link = screen.getByRole('link', { name: /Входящие/ });
    // Window listeners run after React's handler: record whether the app let
    // the browser follow the link, then stop jsdom (it cannot navigate).
    let appPrevented: boolean | undefined;
    const record = (event: Event) => {
      appPrevented = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener('click', record);

    fireEvent.click(link, init);
    window.removeEventListener('click', record);

    expect(onNavigate).not.toHaveBeenCalled();
    expect(appPrevented).toBe(false);
  });

  it('lists tags of open tasks with counts, alphabetically', () => {
    renderSidebar({ location: { ...DEFAULT_LOCATION, view: { kind: 'tag', tag: 'дом' } } });
    const links = within(tagsNav()).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual(['#дом2', '#работа1']);
    expect(links[0]).toHaveAttribute('aria-current', 'page');
  });

  it('explains tags when there are none yet', () => {
    renderSidebar({ tasks: [makeTask({ id: 'plain' })] });

    expect(screen.getByText('Добавьте к задаче #тег — он появится здесь.')).toBeInTheDocument();
  });

  it('hides counts and the tag hint while tasks are not loaded', () => {
    renderSidebar({ tasks: undefined });

    expect(
      within(listsNav())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Сегодня', 'Входящие', 'Предстоящие', 'Просроченные', 'Выполненные']);
    expect(screen.queryByText(/Добавьте к задаче/)).not.toBeInTheDocument();
  });
});
