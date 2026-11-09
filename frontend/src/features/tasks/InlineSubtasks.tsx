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
              <input
                type="checkbox"
                checked={completed}
                aria-disabled={locked || undefined}
                aria-label={
                  completed ? TEXTS.reopenTask(subtask.title) : TEXTS.completeTask(subtask.title)
                }
                onChange={() => {
                  if (!locked) onToggle(subtask);
                }}
                className="size-4 shrink-0 cursor-pointer accent-check aria-disabled:cursor-wait"
              />
              <span
                className={`min-w-0 wrap-anywhere ${completed ? 'text-ink-faint line-through' : 'text-ink-muted'}`}
              >
                {subtask.title}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
