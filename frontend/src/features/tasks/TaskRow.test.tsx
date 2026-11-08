// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOCATION } from '../../domain/view';
import { makeTask } from '../../test/makeTask';
import { TaskRow } from './TaskRow';

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
