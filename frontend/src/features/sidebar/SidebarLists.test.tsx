// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOCATION } from '../../domain/view';
import { makeList } from '../../test/makeList';
import { makeTask } from '../../test/makeTask';

import { Sidebar } from './Sidebar';

const NOW = new Date(2026, 10, 9, 10, 0);
const LISTS = [
  makeList({ id: 'home', name: 'Дом', color: 'brown', position: 2 }),
  makeList({ id: 'work', name: 'Работа', position: 1 }),
  makeList({ id: 'optimistic-1', name: 'Сохраняется', position: 3 }),
];
const TASKS = [
  makeTask({ id: 'a', list_id: 'work' }),
  makeTask({ id: 'b', list_id: 'work' }),
  makeTask({ id: 'done', list_id: 'home', completed_at: '2026-11-08T10:00:00Z' }),
];

function renderSidebar(onCreateList = vi.fn()) {
  const onNavigate = vi.fn();
  render(
    <Sidebar
      tasks={TASKS}
      lists={LISTS}
      now={NOW}
      location={{ ...DEFAULT_LOCATION, query: 'x' }}
      onNavigate={onNavigate}
      onCreateList={onCreateList}
    />,
  );
  return { onNavigate, onCreateList };
}

const favorites = () => screen.getByRole('navigation', { name: 'Избранное' });

describe('Sidebar lists', () => {
  it('shows lists in order with open-task counts; a list being saved is not a link', () => {
    renderSidebar();

    expect(
      within(favorites())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Работа2', 'Дом']);
    const saving = within(favorites()).getByText('Сохраняется').closest('li');
    expect(saving).toHaveAttribute('aria-busy', 'true');
    expect(within(saving as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('links to the list view, keeping the search', async () => {
    const { onNavigate } = renderSidebar();
    const work = within(favorites()).getByRole('link', { name: /Работа/ });

    expect(work).toHaveAttribute('href', '?listId=work&q=x');
    await userEvent.click(work);
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'taskList', listId: 'work' });
  });

  it('creates a list from the inline field; Esc and an empty name create nothing', async () => {
    const { onCreateList } = renderSidebar();

    await userEvent.click(screen.getByRole('button', { name: 'Новый список' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Название списка' }),
      '  Учёба {Enter}',
    );
    expect(onCreateList).toHaveBeenCalledWith('Учёба');

    await userEvent.click(screen.getByRole('button', { name: 'Новый список' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Название списка' }), 'Нет{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Новый список' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Название списка' }), '   {Enter}');
    expect(onCreateList).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Новый список' })).toBeInTheDocument();
  });
});
