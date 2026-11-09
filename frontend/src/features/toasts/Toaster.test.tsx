// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import { ApiError } from '../../api/client';
import { App } from '../../App';
import { AppProviders } from '../../app/AppProviders';
import { TOAST_TEXTS } from '../../constants/texts';
import { useToastStore } from '../../store/toastStore';
import { makeTask } from '../../test/makeTask';
import { TOAST_DURATION_MS } from './ToastItem';
import { Toaster } from './Toaster';

const renderApp = () =>
  render(
    <AppProviders>
      <App />
    </AppProviders>,
  );

describe('failed writes show a toast', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('after a failed completion: rolled back, with a close button', async () => {
    window.history.replaceState(null, '', '/?list=inbox');
    const task = makeTask({ id: 't1', title: 'Сделать тесты' });
    vi.spyOn(api, 'listTasks').mockResolvedValue([task]);
    vi.spyOn(api, 'listLists').mockResolvedValue([]);
    vi.spyOn(api, 'updateTask').mockRejectedValue(new ApiError(500, 'internal_error', 'boom'));
    renderApp();

    await userEvent.click(await screen.findByRole('checkbox', { name: /Сделать тесты/ }));

    const region = screen.getByRole('region', { name: TOAST_TEXTS.region });
    expect(await within(region).findByText(TOAST_TEXTS.updateFailed)).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: /Сделать тесты/ })).not.toBeChecked();
    await userEvent.click(within(region).getByRole('button', { name: TOAST_TEXTS.close }));
    await waitFor(() => {
      expect(within(region).queryByText(TOAST_TEXTS.updateFailed)).not.toBeInTheDocument();
    });
  });

  it('also for quick add, naming the task, with its text brought back', async () => {
    window.history.replaceState(null, '', '/?list=inbox');
    vi.spyOn(api, 'listTasks').mockResolvedValue([]);
    vi.spyOn(api, 'createTask').mockRejectedValue(new ApiError(500, 'internal_error', 'boom'));
    renderApp();

    const input = await screen.findByRole('textbox', { name: 'Новая задача' });
    await userEvent.type(input, 'Задача{Enter}');

    const region = screen.getByRole('region', { name: TOAST_TEXTS.region });
    expect(await within(region).findByText(TOAST_TEXTS.createFailed('Задача'))).toBeInTheDocument();
    expect(input).toHaveValue('Задача');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // one message, not two
  });

  it('Show removes only the secondary action; Ctrl+Z still uses the primary Undo', async () => {
    useToastStore.setState({ toasts: [] });
    render(<Toaster />);
    const undo = vi.fn();
    const show = vi.fn();
    act(() => {
      useToastStore.getState().showToast('Добавлено', {
        action: { label: 'Отменить', undo: true, run: undo },
        secondaryAction: { label: 'Показать', run: show },
      });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Показать' }));
    expect(show).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Показать' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeInTheDocument();
    act(() => {
      useToastStore.getState().undoLatest();
    });
    expect(undo).toHaveBeenCalledOnce();
  });
});

describe('Toaster', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is a polite live region and hides a toast after a while', async () => {
    render(<Toaster />);
    const region = screen.getByRole('region', { name: TOAST_TEXTS.region });
    expect(region).toHaveAttribute('aria-live', 'polite');

    act(() => {
      useToastStore.getState().showToast('Готово');
    });
    expect(within(region).getByText('Готово')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });
    vi.useRealTimers();
    await waitFor(() => {
      expect(within(region).queryByText('Готово')).not.toBeInTheDocument();
    });
  });
});
