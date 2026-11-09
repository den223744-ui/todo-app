import { useUiStore } from '../../store/uiStore';

export function focusQuickAdd(): void {
  document.querySelector<HTMLElement>('[data-quick-add-input]')?.focus();
}

export function focusSearch(): void {
  const field = document.querySelector<HTMLInputElement>('[data-search-input]');
  if (field) field.focus();
  else document.querySelector<HTMLButtonElement>('[data-search-trigger]')?.click();
}

export function focusTask(id: string | null): void {
  useUiStore.getState().selectTask(id);
  requestAnimationFrame(() => {
    const state = useUiStore.getState();
    if (
      state.selectedTaskId !== id ||
      state.editingTaskId ||
      state.paletteOpen ||
      state.helpOpen ||
      state.drawerOpen
    )
      return;
    const link = [...document.querySelectorAll<HTMLElement>('[data-task-link]')].find(
      (element) =>
        element.dataset.taskLink === id &&
        !element.closest('[hidden], [inert], [aria-hidden="true"]'),
    );
    if (link) {
      link.focus({ preventScroll: true });
      link.scrollIntoView({ block: 'nearest' });
    } else if (id === null) focusQuickAdd();
  });
}

export function focusAfterTask(id: string): void {
  const links = [...document.querySelectorAll<HTMLElement>('[data-task-link]')].filter(
    (link) => !link.closest('[hidden], [inert], [aria-hidden="true"]'),
  );
  const index = links.findIndex((link) => link.dataset.taskLink === id);
  const neighbour = links[index + 1] ?? links[index - 1];
  focusTask(neighbour?.dataset.taskLink ?? null);
}
