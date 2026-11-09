// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { api } from '../../api';
import type { TaskRead } from '../../api/schema';
import { addDays, toLocalDateString } from '../../domain/dates';
import { useUiStore } from '../../store/uiStore';
import { useToastStore } from '../../store/toastStore';
import { useThemeStore } from '../../store/themeStore';
import { makeTask } from '../../test/makeTask';
import { makeList } from '../../test/makeList';
import { renderWithClient } from '../../test/renderWithClient';
import { navigateTo } from '../navigation/useAppLocation';

const a = makeTask({ id: 'a', title: 'Первая задача', position: 1 });
const b = makeTask({ id: 'b', title: 'Вторая задача', position: 2, tags: ['работа'] });

function open(tasks = [a, b], url = '/?list=inbox') {
  window.history.replaceState(null, '', url);
  let saved = [...tasks];
  vi.spyOn(api, 'listTasks').mockImplementation(() => Promise.resolve(saved));
  const update = vi.spyOn(api, 'updateTask').mockImplementation((id, { completed, ...patch }) => {
    saved = saved.map((task) =>
      task.id === id
        ? {
            ...task,
            ...patch,
            ...(completed === undefined
              ? {}
              : { completed_at: completed ? new Date().toISOString() : null }),
          }
        : task,
    );
    return Promise.resolve(saved.find((task) => task.id === id) as TaskRead);
  });
  const remove = vi.spyOn(api, 'deleteTask').mockImplementation((id) => {
    saved = saved.filter((task) => task.id !== id);
    return Promise.resolve();
  });
  const restore = vi.spyOn(api, 'restoreTask').mockImplementation((id) => {
    const task = tasks.find((task) => task.id === id) as TaskRead;
    saved.push(task);
    return Promise.resolve(task);
  });
  return {
    ...renderWithClient(<App />, tasks, [makeList({ id: 'work', name: 'Работа' })]),
    update,
    remove,
    restore,
  };
}
const link = (id: string) =>
  document.querySelector<HTMLElement>(`[data-task-link="${id}"]`) as HTMLElement;
const key = (code: string, extra: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { code, ...extra });
async function select(id: string) {
  act(() => {
    link(id).focus();
  });
  await waitFor(() => {
    expect(useUiStore.getState().selectedTaskId).toBe(id);
  });
}

describe('keyboard shortcuts and the command palette', () => {
  beforeEach(() => {
    useUiStore.setState({
      selectedTaskId: null,
      editingTaskId: null,
      paletteOpen: false,
      helpOpen: false,
      drawerOpen: false,
      dragging: false,
      reorderBusy: false,
      dayView: 'list',
    });
    useToastStore.setState({ toasts: [] });
    useThemeStore.getState().setTheme('system');
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('focuses quick add and search, ignores typing/IME/modifiers and keeps Tab arrows local', () => {
    const { queryClient } = open();
    key('KeyN', { key: 'т' });
    expect(screen.getByRole('textbox', { name: 'Новая задача' })).toHaveFocus();
    key('KeyJ', { key: 'о' });
    expect(useUiStore.getState().selectedTaskId).toBeNull();
    act(() => {
      (document.activeElement as HTMLElement).blur();
    });
    key('Slash', { key: '/' });
    expect(screen.getByRole('searchbox')).toHaveFocus();
    act(() => {
      (document.activeElement as HTMLElement).blur();
    });
    key('KeyJ', { key: 'о', isComposing: true });
    key('KeyJ', { key: 'о', ctrlKey: true });
    expect(useUiStore.getState().selectedTaskId).toBeNull();
    queryClient.clear();
  });

  it('moves J/K selection without wrapping, opens details, edits and clears selection', async () => {
    const { queryClient, update } = open();
    key('KeyK', { key: 'л' });
    await waitFor(() => expect(link('a')).toHaveFocus());
    key('KeyJ');
    await waitFor(() => expect(link('b')).toHaveFocus());
    key('KeyJ');
    expect(useUiStore.getState().selectedTaskId).toBe('b');
    key('KeyE');
    const editor = screen.getByRole('textbox', { name: /Изменить название/ });
    expect(editor).toHaveFocus();
    await userEvent.clear(editor);
    await userEvent.type(editor, 'Изменено{Enter}');
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('b', { title: 'Изменено' });
    });
    await waitFor(() => expect(link('b')).toHaveFocus());
    key('', { key: 'Enter' });
    expect(window.location.search).toContain('task=b');
    key('', { key: 'Escape' });
    await waitFor(() => {
      expect(window.location.search).not.toContain('task=');
    });
    await waitFor(() => expect(link('b')).toHaveFocus());
    key('', { key: 'Escape' });
    expect(useUiStore.getState().selectedTaskId).toBeNull();
    queryClient.clear();
  });

  it('toggles with X and deletes with Backspace, focuses a neighbour, supports Undo', async () => {
    const { queryClient, update, remove, restore } = open();
    await select('a');
    key('KeyX');
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('a', { completed: true });
    });
    await waitFor(() => expect(link('b')).toHaveFocus());
    await userEvent.keyboard('{Control>}z{/Control}');
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('a', { completed: false });
    });
    await waitFor(() => expect(link('a')).toBeInTheDocument());
    await select('b');
    key('', { key: 'Backspace' });
    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith('b');
    });
    await waitFor(() => expect(link('a')).toHaveFocus());
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await waitFor(() => {
      expect(restore).toHaveBeenCalledWith('b');
    });
    queryClient.clear();
  });

  it('moves selected tasks with Alt arrows and excludes search, tomorrow and done rows', async () => {
    const { queryClient, update } = open();
    await select('b');
    key('', { key: 'ArrowUp', altKey: true });
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('b', { position: 0 });
    });
    expect(
      screen
        .getAllByRole('link')
        .filter((element) => element.hasAttribute('data-task-link'))
        .map((element) => element.getAttribute('data-task-link')),
    ).toEqual(['b', 'a']);
    expect(link('b')).toHaveFocus();
    expect(useToastStore.getState().toasts).toHaveLength(0);
    await waitFor(() => {
      expect(queryClient.isMutating()).toBe(0);
    });
    key('', { key: 'ArrowDown', altKey: true });
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('b', { position: 2 });
    });
    act(() => {
      navigateTo({ query: 'задача' });
    });
    expect(screen.queryByRole('button', { name: /Переместить «/ })).toBeNull();
    key('', { key: 'ArrowDown', altKey: true });
    expect(update).toHaveBeenCalledTimes(2);
    queryClient.clear();
  });

  it('navigates across groups and clears a selection removed by view/search changes', async () => {
    const today = toLocalDateString(new Date());
    const { queryClient } = open(
      [
        { ...a, due_date: today, list_id: 'work' },
        { ...b, due_date: today },
      ],
      '/',
    );
    await select('a');
    key('KeyJ');
    await waitFor(() => expect(link('b')).toHaveFocus());
    await select('a');
    key('', { key: 'Delete' });
    await waitFor(() => expect(link('b')).toHaveFocus());
    await waitFor(() => {
      expect(link('a')).toBeNull();
    });
    act(() => {
      navigateTo({ query: 'нет такого' });
    });
    await waitFor(() => {
      expect(useUiStore.getState().selectedTaskId).toBeNull();
    });
    queryClient.clear();
  });

  it('opens/closes palette from an input with Ctrl+K and returns focus', async () => {
    const { queryClient } = open();
    const input = screen.getByRole('textbox', { name: 'Новая задача' });
    await userEvent.click(input);
    key('KeyK', { key: 'л', ctrlKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Палитра команд' });
    expect(within(dialog).getByRole('combobox')).toHaveFocus();
    key('KeyK', { key: 'л', ctrlKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(input).toHaveFocus();
    key('KeyK', { key: 'k', metaKey: true });
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveFocus();
    queryClient.clear();
  });

  it('runs palette navigation, task actions and themes, and opens a matched task', async () => {
    const { queryClient, update } = open();
    await select('a');
    key('KeyK', { ctrlKey: true });
    await userEvent.click(screen.getByRole('option', { name: 'На завтра' }));
    const tomorrow = toLocalDateString(addDays(new Date(), 1));
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('a', { due_date: tomorrow });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('a', { due_date: null, due_time: null });
    });
    key('KeyK', { ctrlKey: true });
    await userEvent.click(screen.getByRole('option', { name: 'Тёмная' }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));
    key('KeyK', { ctrlKey: true });
    await userEvent.click(screen.getByRole('option', { name: 'Завтра' }));
    await waitFor(() => {
      expect(window.location.search).toContain(`day=${tomorrow}`);
    });
    key('KeyK', { ctrlKey: true });
    await userEvent.type(
      screen.getByRole('combobox', { name: 'Команда или название задачи…' }),
      'Вторая',
    );
    await userEvent.click(screen.getByRole('option', { name: 'Вторая задача' }));
    await waitFor(() => {
      expect(window.location.search).toContain('task=b');
    });
    queryClient.clear();
  });

  it('shows help via ? and sidebar, traps focus, blocks shortcuts and returns focus', async () => {
    const { queryClient } = open();
    await select('a');
    key('Slash', { key: '?', shiftKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Горячие клавиши' });
    expect(within(dialog).getAllByRole('table')).toHaveLength(3);
    key('KeyN');
    expect(screen.getByRole('textbox', { name: 'Новая задача' })).not.toHaveFocus();
    key('KeyK', { ctrlKey: true });
    expect(screen.queryByRole('dialog', { name: 'Палитра команд' })).toBeNull();
    // Close, then the scrollable list (focusable so it scrolls by keyboard), then back.
    await userEvent.keyboard('{Tab}{Tab}');
    expect(within(dialog).getByRole('region', { name: 'Горячие клавиши' })).toHaveFocus();
    await userEvent.keyboard('{Tab}');
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(link('a')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Горячие клавиши' }));
    expect(screen.getByRole('dialog', { name: 'Горячие клавиши' })).toBeInTheDocument();
    queryClient.clear();
  });

  it('blocks global actions during drag and modal dialogs, and opens mobile search with /', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { queryClient } = open();
    key('Slash', { key: '/' });
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    act(() => {
      useUiStore.setState({ dragging: true });
    });
    key('KeyN');
    expect(screen.getByRole('textbox', { name: 'Новая задача' })).not.toHaveFocus();
    act(() => {
      useUiStore.setState({ dragging: false });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Открыть меню' }));
    key('KeyN');
    expect(screen.getByRole('textbox', { name: 'Новая задача' })).not.toHaveFocus();
    queryClient.clear();
  });
});
