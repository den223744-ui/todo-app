import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useMediaQuery } from '../../components/useMediaQuery';
import { canReorderGroup, reorderSiblings } from '../../domain/reorder';
import { adjacentTask, resolveShortcut } from '../../domain/shortcuts';
import { selectTaskGroups } from '../../domain/taskGroups';
import { useUiStore } from '../../store/uiStore';
import { useLists } from '../lists/useLists';
import { useAppLocation } from '../navigation/useAppLocation';
import { OPTIMISTIC_ID_PREFIX } from '../tasks/taskMutations';
import { taskKeys } from '../tasks/taskQueries';
import { useReorderTasks } from '../tasks/useReorderTasks';
import { useTaskActions } from '../tasks/useTaskActions';
import { useTasks } from '../tasks/useTasks';
import { useNow } from '../time/useNow';

import { focusAfterTask, focusQuickAdd, focusSearch, focusTask } from './focus';

export function GlobalShortcuts() {
  const { data: tasks = [] } = useTasks();
  const { data: lists = [] } = useLists();
  const [location, navigate] = useAppLocation();
  const now = useNow();
  const actions = useTaskActions();
  const reorder = useReorderTasks();
  const client = useQueryClient();
  const selectedId = useUiStore((state) => state.selectedTaskId);
  const dayView = useUiStore((state) => state.dayView);
  const narrow = useMediaQuery('(max-width: 1023.98px)');
  const timelineOnly =
    narrow &&
    dayView === 'timeline' &&
    location.view.kind === 'list' &&
    location.view.list === 'today' &&
    !location.query.trim();
  const groups = useMemo(
    () => (timelineOnly ? [] : selectTaskGroups(tasks, lists, location, now)),
    [tasks, lists, location, now, timelineOnly],
  );
  const visible = groups
    .flatMap((group) => group.tasks)
    .filter((task) => !task.id.startsWith(OPTIMISTIC_ID_PREFIX));

  useEffect(() => {
    if (selectedId && !visible.some((task) => task.id === selectedId))
      useUiStore.getState().selectTask(null);
  }, [visible, selectedId]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const state = useUiStore.getState();
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editable = Boolean(
        target?.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
        ),
      );
      const modal = [...document.querySelectorAll('[aria-modal="true"], dialog[open]')].some(
        (element) => !element.closest('[aria-hidden="true"], [inert]'),
      );
      const shortcut = resolveShortcut(event, {
        editable,
        paletteOpen: state.paletteOpen,
        blocked: state.dragging || state.helpOpen || state.drawerOpen || modal,
        ownsArrows: Boolean(
          target?.closest(
            '[data-shortcut-arrows], [role="tablist"], [role="radiogroup"], [role="menu"], [role="tabpanel"]:focus',
          ),
        ),
      });
      if (!shortcut) return;
      if (
        shortcut === 'open' &&
        target?.closest('button, a') &&
        !target.matches('[data-task-link]')
      )
        return;
      event.preventDefault();
      if (shortcut === 'palette') {
        state.setPaletteOpen(!state.paletteOpen);
        return;
      }
      if (shortcut === 'help') {
        state.setHelpOpen(true);
        return;
      }
      if (shortcut === 'new') {
        focusQuickAdd();
        return;
      }
      if (shortcut === 'search') {
        focusSearch();
        return;
      }
      if (shortcut === 'clear') {
        state.selectTask(null);
        target?.blur();
        return;
      }
      if (shortcut === 'next' || shortcut === 'previous') {
        focusTask(
          adjacentTask(
            visible.map((task) => task.id),
            state.selectedTaskId,
            shortcut === 'next' ? 1 : -1,
          ),
        );
        return;
      }
      const task = visible.find((task) => task.id === state.selectedTaskId);
      if (!task) return;
      if (shortcut === 'open') {
        navigate({ taskId: task.id });
        return;
      }
      if (shortcut === 'edit') {
        state.startEditing(task.id);
        return;
      }
      if (shortcut === 'move-up' || shortcut === 'move-down') {
        const group = groups.find((group) => group.tasks.some((item) => item.id === task.id));
        if (!group || !canReorderGroup(location, group.key) || task.completed_at) return;
        const siblings = reorderSiblings(group).filter(
          (task) => !task.id.startsWith(OPTIMISTIC_ID_PREFIX),
        );
        void reorder(
          siblings,
          task.id,
          siblings.findIndex((item) => item.id === task.id) + (shortcut === 'move-up' ? -1 : 1),
        );
        return;
      }
      const pending = client
        .getMutationCache()
        .findAll({ mutationKey: taskKeys.mutation(), status: 'pending' })
        .some((mutation) => {
          const variables: unknown = mutation.state.variables;
          return (
            variables === task.id ||
            (typeof variables === 'object' &&
              variables !== null &&
              'id' in variables &&
              variables.id === task.id)
          );
        });
      if (pending) return;
      if (shortcut === 'toggle') {
        focusAfterTask(task.id);
        actions.toggle(task);
      }
      if (shortcut === 'delete') {
        focusAfterTask(task.id);
        actions.destroy(task);
        if (location.taskId === task.id) navigate({ taskId: null });
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
    };
  }, [actions, client, groups, location, navigate, reorder, visible]);
  return null;
}
