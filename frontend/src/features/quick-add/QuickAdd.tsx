import { useId, useRef, useState } from 'react';

import { QUICK_ADD_ISSUES, TEXTS } from '../../constants/texts';
import { prepareQuickAdd } from '../../domain/quickAddInput';
import { useAppLocation } from '../navigation/useAppLocation';
import { useCreateTask, useTasks } from '../tasks/useTasks';
import { useNow } from '../time/useNow';
import { HighlightedInput } from './HighlightedInput';

export function QuickAdd() {
  const [value, setValue] = useState('');
  const [added, setAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const submittingRef = useRef(false);
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
      aria-busy={create.isPending}
      className="mt-6 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (composingRef.current || submittingRef.current || data === undefined) return;
        // Re-evaluate the actual submit time, including a tab left open overnight.
        const { task } = prepareQuickAdd(value, location.view, new Date());
        if (!task) return;
        const form = event.currentTarget;
        submittingRef.current = true;
        setAdded(false);
        create.mutate(task, {
          onSuccess: () => {
            setValue('');
            setAdded(true);
            if (form.contains(document.activeElement)) inputRef.current?.focus();
          },
          onSettled: () => {
            submittingRef.current = false;
          },
        });
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
          readOnly={create.isPending}
          invalid={issue !== null}
          describedBy={`${id}-hint${issue ? ` ${id}-issue` : ''}${create.isError ? ` ${id}-error` : ''}`}
          onChange={(next) => {
            setValue(next);
            setAdded(false);
            if (create.isError) create.reset();
          }}
          onCompositionChange={(composing) => {
            composingRef.current = composing;
          }}
        />
        <button
          type="submit"
          disabled={create.isPending || !prepared.task || data === undefined}
          className="min-h-12 shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {create.isPending ? TEXTS.quickAddSaving : TEXTS.quickAddSubmit}
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
      {create.isError && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {TEXTS.quickAddError}
        </p>
      )}
      {added && (
        <p role="status" className="text-xs text-accent-ink">
          {TEXTS.quickAddSuccess}
        </p>
      )}
    </form>
  );
}
