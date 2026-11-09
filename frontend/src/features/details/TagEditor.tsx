import { useId, useState } from 'react';

import type { TaskRead, TaskUpdate } from '../../api/schema';
import { EDIT_ISSUES, EDIT_TEXTS } from '../../constants/texts';
import { addTag, removeTag, type EditIssue } from '../../domain/taskEdit';

interface TagEditorProps {
  task: TaskRead;
  onUpdate: (patch: TaskUpdate) => void;
}

export function TagEditor({ task, onUpdate }: TagEditorProps) {
  const [draft, setDraft] = useState('');
  const [issue, setIssue] = useState<EditIssue | null>(null);
  const inputId = useId();

  const submit = () => {
    const result = addTag(task, draft);
    if (result.kind === 'invalid') {
      setIssue(result.issue);
      return;
    }
    if (result.kind === 'patch') onUpdate(result.patch);
    setDraft('');
  };

  return (
    <div className="detail-property items-start py-1">
      <label htmlFor={inputId} className="pt-2 text-xs text-ink-muted">
        {EDIT_TEXTS.tags}
      </label>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
        {task.tags.length > 0 && (
          <ul className="contents">
            {task.tags.map((tag) => (
              <li
                key={tag}
                className="flex max-w-full min-w-0 items-center rounded-full border border-line pl-2 text-xs"
              >
                {/* A 50-character tag must wrap, not push the panel wider than a phone. */}
                <span className="min-w-0 wrap-anywhere">#{tag}</span>
                <button
                  type="button"
                  aria-label={EDIT_TEXTS.removeTag(tag)}
                  onClick={() => {
                    const result = removeTag(task, tag);
                    if (result.kind === 'patch') onUpdate(result.patch);
                  }}
                  className="flex size-7 shrink-0 items-center justify-center rounded text-ink-muted hover:text-ink"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id={inputId}
          type="text"
          value={draft}
          placeholder={EDIT_TEXTS.addTagPlaceholder}
          aria-invalid={issue !== null || undefined}
          aria-describedby={issue ? `${inputId}-issue` : undefined}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setIssue(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            } else if (event.key === 'Escape' && draft) {
              event.preventDefault(); // clear first; a second Esc closes the panel
              setDraft('');
              setIssue(null);
            }
          }}
          className="h-8 w-24 min-w-0 flex-1 rounded-lg border border-line bg-transparent px-2 text-sm placeholder:text-ink-faint"
        />
      </div>
      {issue && (
        <p id={`${inputId}-issue`} className="col-span-2 text-xs text-danger">
          {EDIT_ISSUES[issue]}
        </p>
      )}
    </div>
  );
}
