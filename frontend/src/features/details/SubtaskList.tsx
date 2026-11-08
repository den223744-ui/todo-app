import { useId, useState } from 'react';

import type { TaskRead, TaskUpdate } from '../../api/schema';
import { EDIT_ISSUES, EDIT_TEXTS, TEXTS } from '../../constants/texts';
import { TITLE_MAX_LENGTH, codePoints } from '../../domain/limits';
import type { EditIssue } from '../../domain/taskEdit';
import { OPTIMISTIC_ID_PREFIX } from '../tasks/taskMutations';
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
        {subtasks.map((subtask) => {
          // Not saved yet: it has no server id to write to. Shown, but locked
          // until the server answers (the row then remounts under its real id).
          const unsaved = subtask.id.startsWith(OPTIMISTIC_ID_PREFIX);
          const locked = unsaved || busyIds.has(subtask.id);
          return (
            <li
              key={subtask.id}
              aria-busy={unsaved || undefined}
              className="flex items-center gap-2"
            >
              <input
                type="checkbox"
                checked={subtask.completed_at !== null}
                aria-disabled={locked || undefined}
                aria-label={
                  subtask.completed_at === null
                    ? TEXTS.completeTask(subtask.title)
                    : TEXTS.reopenTask(subtask.title)
                }
                onChange={() => {
                  if (!locked) onUpdate(subtask, { completed: subtask.completed_at === null });
                }}
                className="size-4 shrink-0 cursor-pointer accent-check aria-disabled:cursor-default"
              />
              {unsaved ? (
                <span className="min-w-0 flex-1 truncate px-1.5 py-1 text-sm text-ink-muted">
                  {subtask.title}
                </span>
              ) : (
                <SubtaskTitle subtask={subtask} onUpdate={onUpdate} />
              )}
              <button
                type="button"
                aria-label={EDIT_TEXTS.deleteSubtask(subtask.title)}
                disabled={unsaved}
                onClick={() => {
                  onDelete(subtask);
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-subtle hover:text-danger disabled:invisible"
              >
                ×
              </button>
            </li>
          );
        })}
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
