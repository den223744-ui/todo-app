import { TaskTitle } from '../../components/TaskTitle';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import type { TaskRead } from '../../api/schema';
import { TEXTS } from '../../constants/texts';
import { OPTIMISTIC_ID_PREFIX } from './taskMutations';

interface InlineSubtasksProps {
  id: string;
  title: string;
  subtasks: readonly TaskRead[];
  busyIds: ReadonlySet<string>;
  onToggle: (task: TaskRead) => void;
}

export function InlineSubtasks({ id, title, subtasks, busyIds, onToggle }: InlineSubtasksProps) {
  return (
    <ul id={id} aria-label={TEXTS.subtasksFor(title)} className="pb-2 pl-9 pr-3 sm:pl-11">
      {subtasks.map((subtask) => {
        const unsaved = subtask.id.startsWith(OPTIMISTIC_ID_PREFIX);
        const locked = unsaved || busyIds.has(subtask.id);
        const completed = subtask.completed_at !== null;
        return (
          <li key={subtask.id} aria-busy={unsaved || undefined}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm">
              <TaskCheckbox
                checked={completed}
                aria-disabled={locked || undefined}
                aria-label={
                  completed ? TEXTS.reopenTask(subtask.title) : TEXTS.completeTask(subtask.title)
                }
                onChange={() => {
                  if (!locked) onToggle(subtask);
                }}
              />
              <TaskTitle completed={completed} className="min-w-0 wrap-break-word text-ink-muted">
                {subtask.title}
              </TaskTitle>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
