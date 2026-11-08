// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import type { TaskRead } from '../../api/schema';
import { makeList } from '../../test/makeList';
import { makeTask } from '../../test/makeTask';
import { listKeys } from '../lists/listQueries';
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

  it('keeps both tags when two quick edits reach a server that answers out of order', async () => {
    window.history.replaceState(null, '', '/?list=inbox&task=p');
    let stored: TaskRead = { ...PARENT };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    let applied = 0;
    vi.spyOn(api, 'listTasks').mockImplementation(() => Promise.resolve([stored, SUB]));
    // The server applies each PATCH when it arrives; the first one is slow.
    vi.spyOn(api, 'updateTask').mockImplementation(async (_id, patch) => {
      if (++calls === 1) await gate;
      stored = { ...stored, ...(patch as Partial<TaskRead>) };
      applied += 1;
      return stored;
    });
    const { queryClient } = renderWithClient(<TaskDetailsContainer />, [PARENT, SUB]);
    const panel = screen.getByRole('complementary', { name: 'Детали задачи' });
    const tagInput = within(panel).getByLabelText('Теги');

    await userEvent.type(tagInput, 'первый{Enter}');
    await within(panel).findByText('#первый');
    await userEvent.type(tagInput, 'второй{Enter}');
    await within(panel).findByText('#второй');
    release();

    // Compare only after the server has applied both requests.
    await waitFor(() => {
      expect(applied).toBe(2);
    });
    expect(stored.tags).toEqual(['дом', 'первый', 'второй']);
    queryClient.clear();
  });

  it('keeps new typing when an earlier save of the same field fails', async () => {
    window.history.replaceState(null, '', '/?list=inbox&task=p');
    let reject!: (error: Error) => void;
    vi.spyOn(api, 'listTasks').mockResolvedValue([PARENT, SUB]);
    vi.spyOn(api, 'updateTask').mockImplementation(
      () =>
        new Promise<TaskRead>((_resolve, rej) => {
          reject = rej;
        }),
    );
    const { queryClient } = renderWithClient(<TaskDetailsContainer />, [PARENT, SUB]);
    const notes = within(screen.getByRole('complementary')).getByLabelText('Заметки');

    await userEvent.type(notes, ' 1');
    fireEvent.blur(notes); // save "Кухня 1": the request hangs
    await userEvent.type(notes, ' 2'); // keep typing meanwhile
    act(() => {
      reject(new Error('offline')); // the first save fails and rolls back
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<TaskRead[]>(['tasks', 'list'])?.[0]?.notes).toBe('Кухня');
    });
    expect(notes).toHaveValue('Кухня 1 2');
    queryClient.clear();
  });

  it('Esc in an edited field reverts it first; a second Esc closes the panel', async () => {
    const { panel, update, queryClient } = open('p');
    const notes = within(panel).getByLabelText('Заметки');

    await userEvent.type(notes, ' черновик');
    await userEvent.keyboard('{Escape}');

    expect(notes).toHaveValue('Кухня');
    expect(screen.getByRole('complementary', { name: 'Детали задачи' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('Esc reverts the title and clears the tag and subtask inputs before closing', async () => {
    const { panel, queryClient } = open('p');
    const title = within(panel).getByLabelText('Название');
    await userEvent.type(title, '!!!');
    await userEvent.keyboard('{Escape}');
    expect(title).toHaveValue('Починить кран');

    for (const label of ['Теги', 'Новая подзадача']) {
      const input = within(panel).getByLabelText(label);
      await userEvent.type(input, 'черновик');
      await userEvent.keyboard('{Escape}');
      expect(input).toHaveValue('');
    }
    expect(screen.getByRole('complementary', { name: 'Детали задачи' })).toBeInTheDocument();
    queryClient.clear();
  });

  it('brings a subtask title back when creating it fails', async () => {
    const { panel, create, queryClient } = open('p');
    create.mockRejectedValueOnce(new Error('offline'));
    const input = within(panel).getByLabelText('Новая подзадача');

    await userEvent.type(input, 'Купить ключ{Enter}');

    await waitFor(() => {
      expect(input).toHaveValue('Купить ключ');
    });
    expect(within(panel).queryByLabelText('Название подзадачи: Купить ключ')).toBeNull();
    queryClient.clear();
  });

  it('keeps new typing when an earlier subtask create fails', async () => {
    const { panel, create, queryClient } = open('p');
    let reject!: (error: Error) => void;
    create.mockImplementationOnce(
      () =>
        new Promise((_resolve, rej) => {
          reject = rej;
        }),
    );
    const input = within(panel).getByLabelText('Новая подзадача');

    await userEvent.type(input, 'Первая{Enter}');
    await userEvent.type(input, 'Вторая');
    act(() => {
      reject(new Error('offline'));
    });

    await waitFor(() => {
      expect(within(panel).queryByLabelText('Название подзадачи: Первая')).toBeNull();
    });
    expect(input).toHaveValue('Вторая');
    queryClient.clear();
  });

  it('locks a subtask until the server has saved it', async () => {
    const { panel, create, update, remove, queryClient } = open('p');
    // The fake server saves the subtask only when released.
    const save = create.getMockImplementation();
    let release!: () => void;
    create.mockImplementationOnce(
      (body) =>
        new Promise((resolve, reject) => {
          release = () => {
            save?.(body).then(resolve, reject);
          };
        }),
    );

    await userEvent.type(within(panel).getByLabelText('Новая подзадача'), 'Ключ{Enter}');
    const checkbox = within(panel).getByRole('checkbox', { name: 'Выполнить: Ключ' });
    expect(checkbox.closest('li')).toHaveAttribute('aria-busy', 'true');
    expect(within(panel).queryByLabelText('Название подзадачи: Ключ')).toBeNull();
    expect(within(panel).getByRole('button', { name: /Удалить подзадачу: Ключ/ })).toBeDisabled();
    await userEvent.click(checkbox);
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();

    act(() => {
      release();
    });
    expect(await within(panel).findByLabelText('Название подзадачи: Ключ')).toBeInTheDocument();
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

  it('moves the task into a list and out again', async () => {
    const { panel, update, queryClient } = open('p');
    queryClient.setQueryData(listKeys.list(), [
      makeList({ id: 'work', name: 'Работа' }),
      makeList({ id: 'optimistic-2', name: 'Сохраняется' }),
    ]);
    const picker = await within(panel).findByRole('combobox', { name: 'Список' });
    expect(within(picker).getByRole('option', { name: 'Сохраняется' })).toBeDisabled();

    await userEvent.selectOptions(picker, 'work');
    await userEvent.selectOptions(picker, '');

    expect(update.mock.calls).toEqual([
      ['p', { list_id: 'work' }],
      ['p', { list_id: null }],
    ]);
    queryClient.clear();
  });

  it('offers no list picker for a subtask (it follows its parent)', () => {
    const { panel, queryClient } = open('s');

    expect(within(panel).queryByRole('combobox', { name: 'Список' })).toBeNull();
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
