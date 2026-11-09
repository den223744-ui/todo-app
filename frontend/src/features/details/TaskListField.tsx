import { useId } from 'react';

import type { TaskListRead, TaskRead, TaskUpdate } from '../../api/schema';
import { EDIT_TEXTS } from '../../constants/texts';
import { OPTIMISTIC_ID_PREFIX } from '../tasks/taskMutations';

/** Which user list a top-level task belongs to, with the list's colour dot. */
export function TaskListField({
  task,
  lists,
  onUpdate,
}: {
  task: TaskRead;
  lists: readonly TaskListRead[];
  onUpdate: (patch: TaskUpdate) => void;
}) {
  const id = useId();
  const selected = lists.find((list) => list.id === task.list_id);
  return (
    <div className="detail-property">
      <label htmlFor={id} className="text-xs text-ink-muted">
        {EDIT_TEXTS.list}
      </label>
      <div className="flex min-w-0 items-center justify-end gap-2">
        {selected && (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: `var(--list-${selected.color})` }}
          />
        )}
        <select
          id={id}
          value={task.list_id ?? ''}
          onChange={(event) => {
            const listId = event.currentTarget.value || null;
            if (listId !== task.list_id) onUpdate({ list_id: listId });
          }}
          className="h-9 min-w-0 max-w-full rounded bg-transparent text-right text-sm"
        >
          <option value="">{EDIT_TEXTS.noList}</option>
          {lists.map((list) => (
            // A list the server has not saved yet cannot be assigned.
            <option
              key={list.id}
              value={list.id}
              disabled={list.id.startsWith(OPTIMISTIC_ID_PREFIX)}
            >
              {list.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
