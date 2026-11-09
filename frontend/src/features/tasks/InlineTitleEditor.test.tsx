// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOCATION } from '../../domain/view';
import { makeTask } from '../../test/makeTask';
import { InlineTitleEditor } from './InlineTitleEditor';
import { TaskRow } from './TaskRow';

const task = makeTask({ id: 't1', title: 'Купить молоко' });

function renderEditor() {
  const onSave = vi.fn();
  const onDone = vi.fn();
  render(<InlineTitleEditor task={task} onSave={onSave} onDone={onDone} />);
  return { onSave, onDone, input: screen.getByRole('textbox') };
}

describe('InlineTitleEditor', () => {
  it('starts focused with the title selected', () => {
    const { input } = renderEditor();

    expect(input).toHaveFocus();
    expect(input).toHaveValue('Купить молоко');
    expect((input as HTMLInputElement).selectionEnd).toBe('Купить молоко'.length);
  });

  it('saves a new trimmed title on Enter', async () => {
    const { onSave, onDone, input } = renderEditor();

    await userEvent.clear(input);
    await userEvent.type(input, '  Купить хлеб {Enter}');

    expect(onSave).toHaveBeenCalledExactlyOnceWith({ title: 'Купить хлеб' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('saves on blur too, and only once', async () => {
    const { onSave, onDone, input } = renderEditor();

    await userEvent.type(input, '!');
    fireEvent.blur(input);
    fireEvent.blur(input);

    expect(onSave).toHaveBeenCalledExactlyOnceWith({ title: 'Купить молоко!' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape without saving, and keeps Escape from closing a panel', async () => {
    const outer = vi.fn();
    const onSave = vi.fn();
    const onDone = vi.fn();
    render(
      <div
        onKeyDown={(event) => {
          if (event.key === 'Escape') outer();
        }}
      >
        <InlineTitleEditor task={task} onSave={onSave} onDone={onDone} />
      </div>,
    );

    await userEvent.type(screen.getByRole('textbox'), 'xyz{Escape}');

    expect(onSave).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it('sends nothing for an unchanged title', async () => {
    const { onSave, onDone } = renderEditor();

    await userEvent.keyboard('{Enter}');

    expect(onSave).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps editing with a hint when Enter would save an empty title', async () => {
    const { onSave, onDone, input } = renderEditor();

    await userEvent.clear(input);
    await userEvent.keyboard('{Enter}');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Название не может быть пустым.')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();

    await userEvent.type(input, 'н');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('drops an empty title on blur, keeping the old one', async () => {
    const { onSave, onDone, input } = renderEditor();

    await userEvent.clear(input);
    fireEvent.blur(input);

    expect(onSave).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('TaskRow inline editing', () => {
  const props = {
    task,
    now: new Date(2026, 10, 8, 12),
    location: DEFAULT_LOCATION,
    busy: false,
    onToggle: vi.fn(),
    onOpen: vi.fn(),
    onRename: vi.fn(),
    onStopEdit: vi.fn(),
  };

  it('starts editing on double click', async () => {
    const onStartEdit = vi.fn();
    render(
      <ul>
        <TaskRow {...props} editing={false} onStartEdit={onStartEdit} />
      </ul>,
    );

    await userEvent.dblClick(screen.getByRole('link'));

    expect(onStartEdit).toHaveBeenCalledWith('t1');
  });

  it('shows the editor while editing and returns focus to the task afterwards', async () => {
    const onRename = vi.fn();
    const { rerender } = render(
      <ul>
        <TaskRow {...props} editing onRename={onRename} onStartEdit={vi.fn()} />
      </ul>,
    );
    await userEvent.type(screen.getByRole('textbox'), '!{Enter}');
    expect(onRename).toHaveBeenCalledWith(task, { title: 'Купить молоко!' });

    rerender(
      <ul>
        <TaskRow {...props} editing={false} onStartEdit={vi.fn()} />
      </ul>,
    );

    expect(screen.getByRole('link')).toHaveFocus();
  });
});
