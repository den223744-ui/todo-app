import { useId, useRef, useState } from 'react';

import { QUICK_ADD_ISSUES, TEXTS } from '../../constants/texts';
import { prepareQuickAdd } from '../../domain/quickAddInput';
import { compareLists } from '../../domain/taskLists';
import { useLists } from '../lists/useLists';
import { useAppLocation } from '../navigation/useAppLocation';
import { useCreateTask, useTasks } from '../tasks/useTasks';
import { useNow } from '../time/useNow';
import { HighlightedInput } from './HighlightedInput';
import { ListPicker } from './ListPicker';

/**
 * Natural-language task input.
 *
 * Optimistic like the rest of the UI: on Enter the task shows up in the list at
 * once and the field clears, so the next task can be typed right away. If the
 * server refuses, the text comes back into the field (unless the user has
 * started typing something else); the app-wide toast names the failed task
 * (SPEC: a failed write is rolled back and reported with a toast).
 */
export function QuickAdd() {
  const [value, setValue] = useState('');
  const [added, setAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const id = useId();
  const [location] = useAppLocation();
  const now = useNow();
  const { data } = useTasks();
  const create = useCreateTask();
  const { data: lists } = useLists();
  // The list picked with the folder button; it wins over the open list.
  const [listId, setListId] = useState('');
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
        const target = listId ? { ...task, list_id: listId } : task;
        setValue('');
        setAdded(false);
        // Submitted with the button: put the caret back for the next task.
        if (event.currentTarget.contains(document.activeElement)) inputRef.current?.focus();
        // mutateAsync, not mutate: mutate's per-call callbacks only fire for the
        // latest call, so a failure of an earlier, still running create would be lost.
        create.mutateAsync(target).then(
          () => {
            setAdded(true);
          },
          () => {
            setValue((current) => (current === '' ? draft : current));
          },
        );
      }}
    >
      <label htmlFor={id} className="sr-only">
        {TEXTS.quickAdd}
      </label>
      <div className="flex items-start gap-2">
        <HighlightedInput
          id={id}
          value={value}
          tokens={prepared.parsed.tokens}
          inputRef={inputRef}
          invalid={issue !== null}
          describedBy={`${id}-hint${issue ? ` ${id}-issue` : ''}`}
          onChange={(next) => {
            setValue(next);
            setAdded(false);
          }}
          onCompositionChange={(composing) => {
            composingRef.current = composing;
          }}
        />
        <ListPicker
          lists={[...(lists ?? [])].sort(compareLists)}
          value={lists?.some((list) => list.id === listId) ? listId : ''}
          onChange={setListId}
        />
        <button
          type="submit"
          disabled={!prepared.task || data === undefined}
          className="min-h-12 shrink-0 rounded-xl border border-line bg-transparent px-4 text-sm font-semibold text-ink hover:border-ink-faint disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:border-line"
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
      {added && (
        <p role="status" className="text-xs text-accent-ink">
          {TEXTS.quickAddSuccess}
        </p>
      )}
    </form>
  );
}
