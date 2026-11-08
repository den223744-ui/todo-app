import { useState } from 'react';

import type { TaskRead, TaskUpdate } from '../../api/schema';
import { EDIT_TEXTS } from '../../constants/texts';
import { editTitle } from '../../domain/taskEdit';

/** A subtask title edited in place; saved on blur or Enter, Esc reverts. */
export function SubtaskTitle({
  subtask,
  onUpdate,
}: {
  subtask: TaskRead;
  onUpdate: (task: TaskRead, patch: TaskUpdate) => void;
}) {
  const [value, setValue] = useState(subtask.title);
  const [synced, setSynced] = useState(subtask.title);
  // Follow outside changes (e.g. the server's answer) while not being edited.
  if (synced !== subtask.title) {
    setSynced(subtask.title);
    setValue(subtask.title);
  }
  const save = () => {
    const result = editTitle(subtask, value);
    if (result.kind === 'patch') onUpdate(subtask, result.patch);
    else setValue(subtask.title); // invalid or unchanged: show the stored title
  };
  return (
    <input
      type="text"
      value={value}
      aria-label={EDIT_TEXTS.subtaskTitle(subtask.title)}
      onChange={(event) => {
        setValue(event.currentTarget.value);
      }}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === 'Escape' && value !== subtask.title) {
          event.preventDefault(); // revert first; a second Esc closes the panel
          setValue(subtask.title);
        }
      }}
      className={`min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-line focus:border-accent-ink ${
        subtask.completed_at !== null ? 'text-ink-faint line-through' : ''
      }`}
    />
  );
}
