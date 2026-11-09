import type { TaskRead, TaskUpdate } from '../../api/schema';
import { EDIT_TEXTS } from '../../constants/texts';
import { editTitle } from '../../domain/taskEdit';
import { useSyncedDraft } from './useSyncedDraft';

/** A subtask title edited in place; saved on blur or Enter, Esc reverts. */
export function SubtaskTitle({
  subtask,
  onUpdate,
}: {
  subtask: TaskRead;
  onUpdate: (task: TaskRead, patch: TaskUpdate) => void;
}) {
  const { draft: value, setDraft: setValue, dirty, revert } = useSyncedDraft(subtask.title);
  const save = () => {
    const result = editTitle(subtask, value);
    if (result.kind === 'patch') onUpdate(subtask, result.patch);
    else revert(); // invalid or unchanged: show the stored title
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
        } else if (event.key === 'Escape' && dirty) {
          event.preventDefault(); // revert first; a second Esc closes the panel
          revert();
        }
      }}
      className={`min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-line focus:border-accent-ink ${
        subtask.completed_at !== null ? 'text-ink-faint line-through' : ''
      }`}
    />
  );
}
