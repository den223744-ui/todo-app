import { useId, useRef, useState } from 'react';

import { QUICK_ADD_ISSUES, TEXTS } from '../../constants/texts';
import { prepareQuickAdd } from '../../domain/quickAddInput';
import { useAppLocation } from '../navigation/useAppLocation';
import { useCreateTask, useTasks } from '../tasks/useTasks';
import { useNow } from '../time/useNow';
import { HighlightedInput } from './HighlightedInput';

/**
 * Natural-language task input.
 *
 * Optimistic like the rest of the UI: on Enter the task shows up in the list at
 * once and the field clears, so the next task can be typed right away. If the
 * server refuses, the text comes back into the field (unless the user has
 * started typing something else) and an error names the task.
 */
export function QuickAdd() {
  const [value, setValue] = useState('');
  const [added, setAdded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const id = useId();
  const [location] = useAppLocation();
  const now = useNow();
  const { data } = useTasks();
  const create = useCreateTask();
  const prepared = prepareQuickAdd(value, location.view, now);
  const issue = value.trim() && prepared.issue ? QUICK_ADD_ISSUES[prepared.issue] : null;

  return (
    <form
      aria-label={TEXTS.quickAdd}
      className="mt-6 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (composingRef.current || data === undefined) return;
        const draft = value;
        // Re-evaluate the actual submit time, including a tab left open overnight.
        const { task } = prepareQuickAdd(draft, location.view, new Date());
        if (!task) return;
        setValue('');
        setAdded(false);
        setFailed(null);
        // Submitted with the button: put the caret back for the next task.
        if (event.currentTarget.contains(document.activeElement)) inputRef.current?.focus();
        // mutateAsync, not mutate: mutate's per-call callbacks only fire for the
        // latest call, so a failure of an earlier, still running create would be lost.
        create.mutateAsync(task).then(
          () => {
            setAdded(true);
          },
          () => {
            setValue((current) => (current === '' ? draft : current));
            setFailed(task.title);
          },
        );
      }}
    >
      <label htmlFor={id} className="block text-sm font-medium">
        {TEXTS.quickAdd}
      </label>
      <div className="flex items-start gap-2">
        <HighlightedInput
          id={id}
          value={value}
          tokens={prepared.parsed.tokens}
          inputRef={inputRef}
          invalid={issue !== null}
          describedBy={`${id}-hint${issue ? ` ${id}-issue` : ''}${failed ? ` ${id}-error` : ''}`}
          onChange={(next) => {
            setValue(next);
            setAdded(false);
          }}
          onCompositionChange={(composing) => {
            composingRef.current = composing;
          }}
        />
        <button
          type="submit"
          disabled={!prepared.task || data === undefined}
          className="min-h-12 shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {TEXTS.quickAddSubmit}
        </button>
      </div>
      <p id={`${id}-hint`} className="text-xs leading-5 text-ink-muted">
        {TEXTS.quickAddHint}
      </p>
      {issue && (
        <p id={`${id}-issue`} className="text-xs text-danger">
          {issue}
        </p>
      )}
      {failed && (
        <div id={`${id}-error`} role="alert" className="flex items-start gap-3 text-sm">
          <p className="flex-1 text-danger">{TEXTS.quickAddError(failed)}</p>
          <button
            type="button"
            onClick={() => {
              setFailed(null);
            }}
            className="min-h-11 rounded-lg px-3 text-ink-muted hover:bg-subtle"
          >
            {TEXTS.dismissError}
          </button>
        </div>
      )}
      {added && (
        <p role="status" className="text-xs text-accent-ink">
          {TEXTS.quickAddSuccess}
        </p>
      )}
    </form>
  );
}
