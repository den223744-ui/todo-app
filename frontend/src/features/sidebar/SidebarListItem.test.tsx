// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import type { TaskRead } from '../../api/schema';
import { parseLocation } from '../../domain/view';
import { makeList } from '../../test/makeList';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';
import { taskKeys } from '../tasks/taskQueries';

import { SidebarContainer } from './SidebarContainer';
import { SidebarListItem } from './SidebarListItem';

const list = makeList({ id: 'work', name: 'Работа' });
const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterAll(() => {
  if (modalDescriptor)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', modalDescriptor);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, 'close', closeDescriptor);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
afterEach(() => {
  vi.restoreAllMocks();
});
function item(busy = false) {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  render(
    <ul>
      <SidebarListItem
        list={list}
        href="/?listId=work"
        active={false}
        count={2}
        busy={busy}
        onNavigate={vi.fn()}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </ul>,
  );
  return {
    onUpdate,
    onDelete,
    trigger: screen.getByRole('button', { name: 'Действия со списком Работа' }),
  };
}

describe('sidebar list actions', () => {
  it('opens by keyboard, navigates arrows/Home/End, closes on Esc and returns focus', async () => {
    const { trigger } = item();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Переименовать' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitemradio', { name: 'Синий' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(within(menu).getByRole('menuitem', { name: 'Удалить' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Переименовать' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{Home}{ArrowRight}{ArrowLeft}{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });
  it('renames on Enter, cancels on Esc and ignores empty names and IME Enter', async () => {
    const { onUpdate, trigger } = item();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Переименовать' }));
    const input = screen.getByRole('textbox', { name: 'Название списка' });
    expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.keyboard('{Enter}');
    expect(input).toBeInTheDocument();
    await userEvent.type(input, ' Проекты ');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onUpdate).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith({ name: 'Проекты' });
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Переименовать' }));
    await userEvent.type(screen.getByRole('textbox'), 'Другое');
    await userEvent.keyboard('{Escape}');
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });
  it('offers six outline colours, selects one and returns focus', async () => {
    const { onUpdate, trigger } = item();
    await userEvent.click(trigger);
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(6);
    expect(screen.getByRole('menuitemradio', { name: 'Синий' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Красный' }));
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith({ color: 'red' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });
  it('confirms list deletion in an alertdialog, with safe initial focus and two cancellation paths', async () => {
    const { onDelete, trigger } = item();
    const show = async () => {
      await userEvent.click(trigger);
      await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }));
    };
    await show();
    let dialog = screen.getByRole('alertdialog', { name: 'Удалить список «Работа»?' });
    expect(within(dialog).getByText('Задачи останутся, но без списка.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Отмена' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    await show();
    fireEvent(
      screen.getByRole('alertdialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    await show();
    dialog = screen.getByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
  it('closes on outside pointer and Tab; pending list writes cannot open the menu', async () => {
    const { trigger } = item();
    await userEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    await userEvent.click(trigger);
    await userEvent.tab();
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it('blocks menu while the list is pending', async () => {
    const { trigger } = item(true);
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(trigger);
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it('deletes the active list, detaches cached tasks, and navigates to Today after success', async () => {
    const task = makeTask({ id: 'task', list_id: 'work' });
    window.history.replaceState(null, '', '/?listId=work');
    vi.spyOn(api, 'deleteList').mockResolvedValue();
    vi.spyOn(api, 'listLists').mockResolvedValue([]);
    vi.spyOn(api, 'listTasks').mockResolvedValue([{ ...task, list_id: null }]);
    const { queryClient } = renderWithClient(<SidebarContainer />, [task], [list]);
    await userEvent.click(screen.getByRole('button', { name: 'Действия со списком Работа' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Удалить' }),
    );
    await waitFor(() => {
      expect(parseLocation(window.location.search).view).toEqual({ kind: 'list', list: 'today' });
    });
    expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())).toEqual([
      { ...task, list_id: null },
    ]);
    queryClient.clear();
  });
});
