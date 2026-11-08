import { useId, useState } from 'react';

import type { TaskRead, TaskUpdate } from '../../api/schema';
import { EDIT_ISSUES, EDIT_TEXTS, TEXTS } from '../../constants/texts';
import {
  editDueDate,
  editDueTime,
  editNotes,
  editPriority,
  editTitle,
  type EditIssue,
  type EditResult,
} from '../../domain/taskEdit';
import { PriorityPicker } from './PriorityPicker';
import { SubtaskList } from './SubtaskList';
import { TagEditor } from './TagEditor';
import { useSyncedDraft } from './useSyncedDraft';

interface TaskDetailsProps {
  task: TaskRead;
  subtasks: readonly TaskRead[];
  busyIds: ReadonlySet<string>;
  canAddSubtasks: boolean;
  onUpdate: (task: TaskRead, patch: TaskUpdate) => void;
  onCreateSubtask: (title: string) => void;
  onDelete: (task: TaskRead) => void;
}

/**
 * All fields of one task. Text fields save when they lose focus (or on Enter
 * for the title); pickers save on change. Edits that change nothing send nothing.
 * Mount with key={task.id}: local drafts belong to one task.
 */
export function TaskDetails({
  task,
  subtasks,
  busyIds,
  canAddSubtasks,
  onUpdate,
  onCreateSubtask,
  onDelete,
}: TaskDetailsProps) {
  const ids = useId();
  // Drafts follow changes made elsewhere, but never over the user's own edits.
  const titleDraft = useSyncedDraft(task.title);
  const notesDraft = useSyncedDraft(task.notes ?? '');
  const title = titleDraft.draft;
  const notes = notesDraft.draft;
  const [issue, setIssue] = useState<{ field: string; issue: EditIssue } | null>(null);
  const completed = task.completed_at !== null;

  const apply = (field: string, result: EditResult) => {
    if (result.kind === 'invalid') {
      setIssue({ field, issue: result.issue });
      return false;
    }
    setIssue(null);
    if (result.kind === 'patch') onUpdate(task, result.patch);
    return true;
  };
  const issueFor = (field: string) => (issue?.field === field ? EDIT_ISSUES[issue.issue] : null);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={completed}
          aria-disabled={busyIds.has(task.id) || undefined}
          aria-label={completed ? TEXTS.reopenTask(task.title) : TEXTS.completeTask(task.title)}
          onChange={() => {
            if (!busyIds.has(task.id)) onUpdate(task, { completed: !completed });
          }}
          className="mt-2.5 size-4 shrink-0 cursor-pointer accent-accent"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={`${ids}-title`} className="sr-only">
            {EDIT_TEXTS.title}
          </label>
          <input
            id={`${ids}-title`}
            type="text"
            value={title}
            aria-invalid={issueFor('title') !== null || undefined}
            aria-describedby={issueFor('title') ? `${ids}-title-issue` : undefined}
            onChange={(event) => {
              titleDraft.setDraft(event.currentTarget.value);
            }}
            onBlur={() => {
              // An invalid title is not kept: the stored one comes back.
              if (!apply('title', editTitle(task, title))) titleDraft.revert();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                apply('title', editTitle(task, title));
              } else if (event.key === 'Escape' && titleDraft.dirty) {
                event.preventDefault(); // revert first; a second Esc closes the panel
                titleDraft.revert();
                setIssue(null);
              }
            }}
            className={`w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-base font-medium hover:border-line focus:border-accent-ink ${
              completed ? 'text-ink-faint line-through' : ''
            }`}
          />
          {issueFor('title') && (
            <p id={`${ids}-title-issue`} className="mt-1 px-2 text-xs text-danger">
              {issueFor('title')}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={`${ids}-notes`} className="mb-1.5 block text-xs font-medium text-ink-muted">
          {EDIT_TEXTS.notes}
        </label>
        <textarea
          id={`${ids}-notes`}
          value={notes}
          rows={4}
          placeholder={EDIT_TEXTS.notesPlaceholder}
          aria-invalid={issueFor('notes') !== null || undefined}
          aria-describedby={issueFor('notes') ? `${ids}-notes-issue` : undefined}
          onChange={(event) => {
            notesDraft.setDraft(event.currentTarget.value);
          }}
          onBlur={() => {
            apply('notes', editNotes(task, notes));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && notesDraft.dirty) {
              event.preventDefault(); // revert first; a second Esc closes the panel
              notesDraft.revert();
              setIssue(null);
            }
          }}
          className="w-full resize-y rounded-lg border border-line bg-surface px-2.5 py-2 text-sm placeholder:text-ink-faint"
        />
        {issueFor('notes') && (
          <p id={`${ids}-notes-issue`} className="mt-1 text-xs text-danger">
            {issueFor('notes')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor={`${ids}-date`}
            className="mb-1.5 block text-xs font-medium text-ink-muted"
          >
            {EDIT_TEXTS.dueDate}
          </label>
          <input
            id={`${ids}-date`}
            type="date"
            value={task.due_date ?? ''}
            min="1000-01-01"
            max="9999-12-31"
            onChange={(event) => {
              apply('date', editDueDate(task, event.currentTarget.value));
            }}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor={`${ids}-time`}
            className="mb-1.5 block text-xs font-medium text-ink-muted"
          >
            {EDIT_TEXTS.dueTime}
          </label>
          <input
            id={`${ids}-time`}
            // Remount when the stored time changes, so the field shows it.
            key={task.due_time ?? 'none'}
            type="time"
            defaultValue={task.due_time?.slice(0, 5) ?? ''}
            aria-invalid={issueFor('time') !== null || undefined}
            aria-describedby={issueFor('time') ? `${ids}-time-issue` : undefined}
            onBlur={(event) => {
              apply('time', editDueTime(task, event.currentTarget.value));
            }}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
        </div>
        {task.due_date && (
          <button
            type="button"
            onClick={() => {
              apply('date', editDueDate(task, ''));
            }}
            className="min-h-9 rounded-lg px-2.5 text-sm text-ink-muted hover:bg-subtle hover:text-ink"
          >
            {EDIT_TEXTS.clearDate}
          </button>
        )}
      </div>
      {issueFor('time') && (
        <p id={`${ids}-time-issue`} className="-mt-3 text-xs text-danger">
          {issueFor('time')}
        </p>
      )}

      <PriorityPicker
        value={task.priority}
        onChange={(priority) => {
          apply('priority', editPriority(task, priority));
        }}
      />

      <TagEditor
        task={task}
        onUpdate={(patch) => {
          onUpdate(task, patch);
        }}
      />

      {task.parent_id === null && (
        <SubtaskList
          subtasks={subtasks}
          busyIds={busyIds}
          canAdd={canAddSubtasks}
          onUpdate={onUpdate}
          onCreate={onCreateSubtask}
          onDelete={onDelete}
        />
      )}

      <div className="border-t border-line pt-4">
        <button
          type="button"
          onClick={() => {
            onDelete(task);
          }}
          className="min-h-9 rounded-lg px-2.5 text-sm text-danger hover:bg-subtle"
        >
          {EDIT_TEXTS.deleteTask}
        </button>
      </div>
    </div>
  );
}
