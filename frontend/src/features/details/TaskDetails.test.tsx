// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import type { TaskRead } from '../../api/schema';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';
import { TaskDetailsContainer } from './TaskDetailsContainer';

const PARENT = makeTask({
  id: 'p',
  title: 'Починить кран',
  notes: 'Кухня',
  priority: 1,
  due_date: '2026-11-09',
  due_time: '18:00:00',
  tags: ['дом'],
});
const SUB = makeTask({ id: 's', title: 'Купить прокладку', parent_id: 'p' });

/** Opens the panel over a tiny in-memory server, so refetches see the writes. */
function open(taskId: string, tasks: TaskRead[] = [PARENT, SUB]) {
  window.history.replaceState(null, '', `/?list=inbox&task=${taskId}`);
  let store = tasks.map((task) => ({ ...task }));
  vi.spyOn(api, 'listTasks').mockImplementation(() => Promise.resolve(store));
  const update = vi.spyOn(api, 'updateTask').mockImplementation((id, patch) => {
    const { completed, ...fields } = patch;
    store = store.map((task) =>
      task.id === id
        ? {
            ...task,
            ...(fields as Partial<TaskRead>),
            ...(completed === undefined
              ? {}
              : { completed_at: completed ? '2026-11-08T12:00:00Z' : null }),
          }
        : task,
    );
    return Promise.resolve(store.find((task) => task.id === id) as TaskRead);
  });
  const create = vi.spyOn(api, 'createTask').mockImplementation((body) => {
    const created = makeTask({
      id: `new-${String(store.length)}`,
      title: body.title,
      parent_id: body.parent_id ?? null,
      position: 10,
    });
    store = [...store, created];
    return Promise.resolve(created);
  });
  const remove = vi.spyOn(api, 'deleteTask').mockImplementation((id) => {
    store = store.filter((task) => task.id !== id && task.parent_id !== id);
    return Promise.resolve();
  });
  const result = renderWithClient(<TaskDetailsContainer />, tasks);
  const panel = screen.getByRole('complementary', { name: 'Детали задачи' });
  return { ...result, panel, update, create, remove };
}

describe('TaskDetailsContainer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing without an open task', () => {
    renderWithClient(<TaskDetailsContainer />, [PARENT]);

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('shows the task and moves focus into the panel', () => {
    const { panel, queryClient } = open('p');

    expect(screen.getByRole('heading', { name: 'Детали задачи' })).toHaveFocus();
    expect(within(panel).getByLabelText('Название')).toHaveValue('Починить кран');
    expect(within(panel).getByLabelText('Заметки')).toHaveValue('Кухня');
    expect(within(panel).getByLabelText('Дата')).toHaveValue('2026-11-09');
    expect(within(panel).getByLabelText('Время')).toHaveValue('18:00');
    expect(within(panel).getByRole('radio', { name: 'Низкий приоритет' })).toBeChecked();
    expect(within(panel).getByText('#дом')).toBeInTheDocument();
    expect(
      within(panel).getByLabelText('Название подзадачи: Купить прокладку'),
    ).toBeInTheDocument();
    queryClient.clear();
  });

  it('saves the title on Enter and notes on blur, nothing when unchanged', async () => {
    const { panel, update, queryClient } = open('p');
    const title = within(panel).getByLabelText('Название');

    await userEvent.clear(title);
    await userEvent.type(title, 'Починить кран на кухне{Enter}');
    // The optimistic update lands a few ms later; a person cannot click faster.
    await screen.findByRole('checkbox', { name: 'Выполнить: Починить кран на кухне' });
    const notes = within(panel).getByLabelText('Заметки');
    await userEvent.click(notes);
    fireEvent.blur(notes); // unchanged: no request
    await userEvent.type(notes, ', срочно');
    fireEvent.blur(notes);

    await waitFor(() => {
      expect(update.mock.calls).toEqual([
        ['p', { title: 'Починить кран на кухне' }],
        ['p', { notes: 'Кухня, срочно' }],
      ]);
    });
    queryClient.clear();
  });

  it('brings the stored title back after an invalid edit', async () => {
    const { panel, update, queryClient } = open('p');
    const title = within(panel).getByLabelText('Название');

    await userEvent.clear(title);
    await userEvent.keyboard('{Enter}');
    expect(within(panel).getByText('Название не может быть пустым.')).toBeInTheDocument();
    fireEvent.blur(title);

    expect(title).toHaveValue('Починить кран');
    expect(update).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('changes priority, date, time and clears the date', async () => {
    const { panel, update, queryClient } = open('p');

    await userEvent.click(within(panel).getByRole('radio', { name: 'Высокий приоритет' }));
    fireEvent.change(within(panel).getByLabelText('Дата'), { target: { value: '2026-11-12' } });
    const time = within(panel).getByLabelText('Время');
    fireEvent.change(time, { target: { value: '09:30' } });
    fireEvent.blur(time);
    await userEvent.click(within(panel).getByRole('button', { name: 'Убрать дату' }));

    await waitFor(() => {
      expect(update.mock.calls).toEqual([
        ['p', { priority: 3 }],
        ['p', { due_date: '2026-11-12' }],
        ['p', { due_time: '09:30:00' }],
        ['p', { due_date: null }],
      ]);
    });
    queryClient.clear();
  });

  it('explains that a time needs a date', () => {
    const undated = makeTask({ id: 'u', title: 'Без даты' });
    const { panel, update, queryClient } = open('u', [undated]);
    const time = within(panel).getByLabelText('Время');

    fireEvent.change(time, { target: { value: '09:30' } });
    fireEvent.blur(time);

    expect(
      within(panel).getByText('Сначала выберите дату — время без даты не сохраняется.'),
    ).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('adds and removes tags, with a hint for an invalid one', async () => {
    const { panel, update, queryClient } = open('p');
    const tagInput = within(panel).getByLabelText('Теги');

    await userEvent.type(tagInput, '#Ремонт{Enter}');
    await within(panel).findByText('#ремонт'); // wait for the optimistic update
    await userEvent.type(tagInput, `${'я'.repeat(51)}{Enter}`);
    expect(within(panel).getByText('Тег должен быть не длиннее 50 символов.')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Убрать тег дом' }));

    await waitFor(() => {
      expect(update.mock.calls).toEqual([
        ['p', { tags: ['дом', 'ремонт'] }],
        ['p', { tags: ['ремонт'] }],
      ]);
    });
    queryClient.clear();
  });

  it('adds, completes, renames and deletes subtasks', async () => {
    const { panel, update, create, remove, queryClient } = open('p');

    await userEvent.type(within(panel).getByLabelText('Новая подзадача'), '  Ключ {Enter}');
    expect(create).toHaveBeenCalledWith({ title: 'Ключ', parent_id: 'p' });
    await userEvent.click(
      within(panel).getByRole('checkbox', { name: 'Выполнить: Купить прокладку' }),
    );
    const subtitle = within(panel).getByLabelText('Название подзадачи: Купить прокладку');
    await userEvent.type(subtitle, ' 1/2{Enter}');
    await userEvent.click(
      within(panel).getByRole('button', { name: /Удалить подзадачу: Купить прокладку/ }),
    );

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith('s');
    });
    expect(update.mock.calls).toEqual([
      ['s', { completed: true }],
      ['s', { title: 'Купить прокладку 1/2' }],
    ]);
    queryClient.clear();
  });

  it('completes the task itself', async () => {
    const { panel, update, queryClient } = open('p');

    await userEvent.click(
      within(panel).getByRole('checkbox', { name: 'Выполнить: Починить кран' }),
    );

    expect(update).toHaveBeenCalledWith('p', { completed: true });
    queryClient.clear();
  });

  it('deletes the task and closes the panel', async () => {
    const { panel, remove, queryClient } = open('p');

    await userEvent.click(within(panel).getByRole('button', { name: 'Удалить задачу' }));

    expect(remove).toHaveBeenCalledWith('p');
    expect(window.location.search).toBe('?list=inbox');
    queryClient.clear();
  });

  it('closes with Escape or the close button, keeping the view', async () => {
    const { queryClient } = open('p');

    await userEvent.keyboard('{Escape}');
    expect(window.location.search).toBe('?list=inbox');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    queryClient.clear();

    const second = open('p');
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть детали' }));
    expect(window.location.search).toBe('?list=inbox');
    second.queryClient.clear();
  });

  it('shows a note for a task that does not exist (e.g. deleted elsewhere)', () => {
    const { panel, queryClient } = open('gone');

    expect(within(panel).getByText('Задача не найдена')).toBeInTheDocument();
    queryClient.clear();
  });

  it('opens a subtask without its own subtask list', () => {
    const { panel, queryClient } = open('s');

    expect(within(panel).getByLabelText('Название')).toHaveValue('Купить прокладку');
    expect(within(panel).queryByLabelText('Новая подзадача')).not.toBeInTheDocument();
    queryClient.clear();
  });

  it('does not offer subtasks for a task the server has not saved yet', () => {
    const pending = makeTask({ id: 'optimistic-1', title: 'Сохраняется' });
    const { panel, queryClient } = open('optimistic-1', [pending]);

    expect(within(panel).queryByLabelText('Новая подзадача')).not.toBeInTheDocument();
    queryClient.clear();
  });
});
