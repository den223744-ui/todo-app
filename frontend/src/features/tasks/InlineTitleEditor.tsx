import { useEffect, useId, useRef, useState } from 'react';

import type { TaskRead, TaskUpdate } from '../../api/schema';
import { EDIT_ISSUES, EDIT_TEXTS } from '../../constants/texts';
import { editTitle, type EditIssue } from '../../domain/taskEdit';

interface InlineTitleEditorProps {
  task: TaskRead;
  onSave: (patch: TaskUpdate) => void;
  /** Called once editing ends, saved or cancelled. */
  onDone: () => void;
  className?: string;
}

/**
 * Edits a title in place: Enter or leaving the field saves, Esc cancels.
 * An unchanged title sends nothing; an invalid one shows a hint on Enter and
 * is discarded on blur (the old title stays).
 */
export function InlineTitleEditor({
  task,
  onSave,
  onDone,
  className = '',
}: InlineTitleEditorProps) {
  const [value, setValue] = useState(task.title);
  const [issue, setIssue] = useState<EditIssue | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishedRef = useRef(false);
  const hintId = useId();

  useEffect(() => {
    // select() alone does not reliably move focus: focus first, then select.
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (save: boolean, fromEnter: boolean) => {
    if (finishedRef.current) return;
    if (save) {
      const result = editTitle(task, value);
      if (result.kind === 'invalid' && fromEnter) {
        setIssue(result.issue);
        return;
      }
      if (result.kind === 'patch') onSave(result.patch);
    }
    finishedRef.current = true;
    onDone();
  };

  return (
    <span className={`block ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        aria-label={EDIT_TEXTS.editTitle(task.title)}
        aria-invalid={issue !== null || undefined}
        aria-describedby={issue ? hintId : undefined}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          setIssue(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            finish(true, true);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation(); // Esc must not also close a surrounding panel
            finish(false, false);
          }
        }}
        onBlur={() => {
          finish(true, false);
        }}
        className="block w-full rounded-md border border-accent-ink bg-surface px-2 py-1 text-sm text-ink outline-none"
      />
      {issue && (
        <span id={hintId} className="mt-1 block text-xs text-danger">
          {EDIT_ISSUES[issue]}
        </span>
      )}
    </span>
  );
}
