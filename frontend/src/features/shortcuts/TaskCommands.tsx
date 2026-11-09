import { Command } from 'cmdk';
import { useMutationState } from '@tanstack/react-query';
import type { TaskRead } from '../../api/schema';
import { PALETTE_TEXTS } from '../../constants/texts';
import { addDays, toLocalDateString } from '../../domain/dates';
import { useAppLocation } from '../navigation/useAppLocation';
import { useTaskActions } from '../tasks/useTaskActions';
import { mutationTaskId } from '../tasks/taskMutations';
import { taskKeys } from '../tasks/taskQueries';
import { focusAfterTask } from './focus';

export function TaskCommands({ task, run }: { task: TaskRead; run: (action: () => void) => void }) {
  const actions = useTaskActions();
  const [location, navigate] = useAppLocation();
  const pendingIds = useMutationState({
    filters: { mutationKey: taskKeys.mutation(), status: 'pending' },
    select: (mutation) => mutationTaskId(mutation.state.variables),
  });
  const busy = pendingIds.includes(task.id);
  const commands = [
    {
      value: 'task-toggle',
      label: task.completed_at ? PALETTE_TEXTS.reopen : PALETTE_TEXTS.complete,
      action: () => {
        focusAfterTask(task.id);
        actions.toggle(task);
      },
    },
    {
      value: 'task-today',
      label: PALETTE_TEXTS.today,
      action: () => {
        actions.schedule(task, toLocalDateString(new Date()));
      },
    },
    {
      value: 'task-tomorrow',
      label: PALETTE_TEXTS.tomorrow,
      action: () => {
        actions.schedule(task, toLocalDateString(addDays(new Date(), 1)));
      },
    },
    {
      value: 'task-delete',
      label: PALETTE_TEXTS.delete,
      action: () => {
        focusAfterTask(task.id);
        actions.destroy(task);
        if (location.taskId === task.id) navigate({ taskId: null });
      },
    },
  ];
  return (
    <Command.Group heading={PALETTE_TEXTS.task}>
      {commands.map((command) => (
        <Command.Item
          key={command.value}
          value={command.value}
          keywords={[command.label]}
          disabled={busy}
          onSelect={() => {
            run(command.action);
          }}
        >
          {command.label}
        </Command.Item>
      ))}
    </Command.Group>
  );
}
