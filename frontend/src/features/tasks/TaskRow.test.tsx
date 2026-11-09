// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOCATION } from '../../domain/view';
import { makeTask } from '../../test/makeTask';
import { TaskRow } from './TaskRow';

const editProps = {
  editing: false,
  onStartEdit: vi.fn(),
  onRename: vi.fn(),
  onStopEdit: vi.fn(),
};

const now = new Date(2026, 10, 8, 12);

describe('TaskRow', () => {
  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ])('preserves browser link behavior for %j', (modifiers) => {
    const onOpen = vi.fn();
    render(
      <ul>
        <TaskRow
          task={makeTask({ id: 't1' })}
          now={now}
          location={DEFAULT_LOCATION}
          busy={false}
          {...editProps}
          onToggle={vi.fn()}
          onOpen={onOpen}
        />
      </ul>,
    );
    // Inspect React's decision before stopping jsdom's unsupported navigation.
    let appPrevented: boolean | undefined;
    const record = (event: Event) => {
      appPrevented = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener('click', record);
    fireEvent.click(screen.getByRole('link'), modifiers);
    window.removeEventListener('click', record);
    expect(appPrevented).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens a task with Enter and leaves the checkbox unchanged', async () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    render(
      <ul>
        <TaskRow
          task={makeTask({ id: 't1' })}
          now={now}
          location={DEFAULT_LOCATION}
          busy={false}
          {...editProps}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      </ul>,
    );
    screen.getByRole('link').focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith('t1');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('ignores toggles while its own write is in flight, keeping focus', async () => {
    const onToggle = vi.fn();
    render(
      <ul>
        <TaskRow
          task={makeTask({ id: 't1' })}
          now={now}
          location={DEFAULT_LOCATION}
          busy
          {...editProps}
          onToggle={onToggle}
          onOpen={vi.fn()}
        />
      </ul>,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    expect(checkbox).toBeEnabled(); // still focusable for keyboard users
    checkbox.focus();
    await userEvent.keyboard(' ');
    expect(onToggle).not.toHaveBeenCalled();
    expect(checkbox).toHaveFocus();
    expect(checkbox).not.toBeChecked();
  });

  it.each([
    [1, 'Низкий приоритет'],
    [2, 'Средний приоритет'],
  ] as const)(
    'shows priority %i without treating completed dates as overdue',
    (priority, label) => {
      render(
        <ul>
          <TaskRow
            task={makeTask({
              id: 't1',
              due_date: '2026-11-07',
              priority,
              completed_at: '2026-11-08T10:00:00Z',
            })}
            now={now}
            location={DEFAULT_LOCATION}
            busy={false}
            {...editProps}
            onToggle={vi.fn()}
            onOpen={vi.fn()}
          />
        </ul>,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(document.querySelector('time')).not.toHaveClass('text-danger');
    },
  );
});

describe('the row bin', () => {
  const renderRow = (location = DEFAULT_LOCATION) => {
    const onDelete = vi.fn();
    const onStartEdit = vi.fn();
    render(
      <ul>
        <TaskRow
          task={makeTask({ id: 't1', title: 'Позвонить' })}
          now={now}
          location={location}
          busy={false}
          {...editProps}
          onStartEdit={onStartEdit}
          onToggle={vi.fn()}
          onOpen={vi.fn()}
          onDelete={onDelete}
        />
      </ul>,
    );
    return { onDelete, onStartEdit };
  };

  it('stays hidden when the row is only focused, so the row does not shift under the pointer', () => {
    renderRow();
    fireEvent.focus(screen.getByRole('link'));
    expect(screen.queryByRole('button', { name: /Удалить задачу/ })).toBeNull();
  });

  it('ignores the second click of a double click, which renames instead', () => {
    const { onDelete, onStartEdit } = renderRow({ ...DEFAULT_LOCATION, taskId: 't1' });
    const bin = screen.getByRole('button', { name: /Удалить задачу/ });
    fireEvent.click(bin, { detail: 2 });
    fireEvent.doubleClick(bin);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onStartEdit).toHaveBeenCalledWith('t1');
    fireEvent.click(bin, { detail: 1 });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not rename on a double click of the checkbox', () => {
    const { onStartEdit } = renderRow();
    fireEvent.doubleClick(screen.getByRole('checkbox'));
    expect(onStartEdit).not.toHaveBeenCalled();
  });
});

describe('a task the server has not saved yet', () => {
  it('cannot be opened, renamed or completed', async () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    const onStartEdit = vi.fn();
    render(
      <ul>
        <TaskRow
          task={makeTask({ id: 'optimistic-1', title: 'Сохраняется' })}
          now={now}
          location={DEFAULT_LOCATION}
          busy={false}
          onToggle={onToggle}
          onOpen={onOpen}
          editing={false}
          onStartEdit={onStartEdit}
          onRename={vi.fn()}
          onStopEdit={vi.fn()}
        />
      </ul>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Сохраняется').closest('[aria-busy="true"]')).not.toBeNull();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(checkbox);
    await userEvent.dblClick(screen.getByText('Сохраняется'));

    expect(onToggle).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onStartEdit).not.toHaveBeenCalled();
  });
});
