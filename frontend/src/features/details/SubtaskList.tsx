import { useId, useState } from 'react';

import type { TaskRead, TaskUpdate } from '../../api/schema';
import { EDIT_ISSUES, EDIT_TEXTS, TEXTS } from '../../constants/texts';
import { TITLE_MAX_LENGTH, codePoints } from '../../domain/limits';
import type { EditIssue } from '../../domain/taskEdit';
import { SubtaskTitle } from './SubtaskTitle';

interface SubtaskListProps {
  subtasks: readonly TaskRead[];
  busyIds: ReadonlySet<string>;
  /** False while the parent itself is not saved yet (it has no server id). */
  canAdd: boolean;
  onUpdate: (task: TaskRead, patch: TaskUpdate) => void;
  /** Resolves when saved; rejects when the server refused (the row is rolled back). */
  onCreate: (title: string) => Promise<unknown>;
  onDelete: (task: TaskRead) => void;
}

export function SubtaskList({
  subtasks,
  busyIds,
  canAdd,
  onUpdate,
  onCreate,
  onDelete,
}: SubtaskListProps) {
  const [draft, setDraft] = useState('');
  const [issue, setIssue] = useState<EditIssue | null>(null);
  const addId = useId();

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    if (codePoints(title) > TITLE_MAX_LENGTH) {
      setIssue('title-too-long');
      return;
    }
    setDraft('');
    // On failure the optimistic row disappears: bring the text back so it is
    // not lost — unless the user is already typing the next subtask.
    onCreate(title).catch(() => {
      setDraft((current) => (current === '' ? title : current));
    });
  };

  return (
    <section aria-labelledby={`${addId}-heading`}>
      <h3 id={`${addId}-heading`} className="mb-1.5 text-xs font-medium text-ink-muted">
        {EDIT_TEXTS.subtasks}
      </h3>
      <ul className="space-y-1">
        {subtasks.map((subtask) => (
          <li key={subtask.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={subtask.completed_at !== null}
              aria-disabled={busyIds.has(subtask.id) || undefined}
              aria-label={
                subtask.completed_at === null
                  ? TEXTS.completeTask(subtask.title)
                  : TEXTS.reopenTask(subtask.title)
              }
              onChange={() => {
                if (!busyIds.has(subtask.id)) {
                  onUpdate(subtask, { completed: subtask.completed_at === null });
                }
              }}
              className="size-4 shrink-0 cursor-pointer accent-accent"
            />
            <SubtaskTitle subtask={subtask} onUpdate={onUpdate} />
            <button
              type="button"
              aria-label={EDIT_TEXTS.deleteSubtask(subtask.title)}
              onClick={() => {
                onDelete(subtask);
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-subtle hover:text-danger"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {canAdd && (
        <div className="mt-2">
          <input
            type="text"
            value={draft}
            aria-label={EDIT_TEXTS.addSubtask}
            placeholder={EDIT_TEXTS.addSubtaskPlaceholder}
            aria-invalid={issue !== null || undefined}
            aria-describedby={issue ? `${addId}-issue` : undefined}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setIssue(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                add();
              } else if (event.key === 'Escape' && draft) {
                event.preventDefault(); // clear first; a second Esc closes the panel
                setDraft('');
                setIssue(null);
              }
            }}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm placeholder:text-ink-faint"
          />
          {issue && (
            <p id={`${addId}-issue`} className="mt-1 text-xs text-danger">
              {EDIT_ISSUES[issue]}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
