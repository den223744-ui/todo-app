import { useId, useLayoutEffect, useRef, useState } from 'react';

import { LIST_TITLES, QUICK_ADD_ISSUES, TEXTS } from '../../constants/texts';
import { quickAddFeedback } from '../../domain/quickAddFeedback';
import { prepareQuickAdd } from '../../domain/quickAddInput';
import { compareLists } from '../../domain/taskLists';
import { useLists } from '../lists/useLists';
import { useAppLocation } from '../navigation/useAppLocation';
import { OPTIMISTIC_ID_PREFIX } from '../tasks/taskMutations';
import { useTasks } from '../tasks/useTasks';
import { useUndoableCreate } from '../tasks/useUndoableCreate';
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
  const formRef = useRef<HTMLFormElement>(null);
  // Share the actual dock height (including errors/safe area) with scroll padding and toasts.
  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const root = document.documentElement;
    const measure = () => {
      root.style.setProperty(
        '--quick-add-height',
        `${String(form.getBoundingClientRect().height)}px`,
      );
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(form);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--quick-add-height');
    };
  }, []);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const id = useId();
  const [location, navigate] = useAppLocation();
  const now = useNow();
  const { data } = useTasks();
  const create = useUndoableCreate();
  const { data: lists } = useLists();
  // Saving may finish after navigation: feedback describes the screen open then.
  const contextRef = useRef({ location, lists });
  contextRef.current = { location, lists };
  // The list picked with the folder button; it wins over the open list.
  const [listId, setListId] = useState<string | null | undefined>(undefined);
  const savedLists = (lists ?? []).filter((list) => !list.id.startsWith(OPTIMISTIC_ID_PREFIX));
  const prepared = prepareQuickAdd(
    value,
    location.view,
    now,
    location.day ?? null,
    savedLists,
    listId,
  );
  const issue = value.trim() && prepared.issue ? QUICK_ADD_ISSUES[prepared.issue] : null;

  return (
    <form
      ref={formRef}
      aria-label={TEXTS.quickAdd}
      className="fixed inset-x-0 bottom-0 z-20 space-y-2 border-t border-line bg-canvas px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:static md:mt-6 md:border-0 md:bg-transparent md:p-0"
      onSubmit={(event) => {
        event.preventDefault();
        if (composingRef.current || data === undefined) return;
        const draft = value;
        // Re-evaluate the actual submit time, including a tab left open overnight.
        const { task } = prepareQuickAdd(
          draft,
          location.view,
          new Date(),
          location.day ?? null,
          savedLists,
          listId,
        );
        if (!task) return;
        setValue('');
        // Submitted with the button: put the caret back for the next task.
        if (event.currentTarget.contains(document.activeElement)) inputRef.current?.focus();
        // mutateAsync, not mutate: mutate's per-call callbacks only fire for the
        // latest call, so a failure of an earlier, still running create would be lost.
        create(task, (created) => {
          const context = contextRef.current;
          const feedback = quickAddFeedback(
            created,
            context.lists ?? [],
            context.location,
            new Date(),
          );
          return {
            message: TEXTS.quickAddAdded(
              feedback.listName ?? LIST_TITLES[feedback.section],
              feedback.dateLabel,
            ),
            options: {
              ...(!feedback.visible && {
                secondaryAction: {
                  label: TEXTS.quickAddShow,
                  run: () => {
                    navigate(feedback.destination);
                  },
                },
              }),
            },
          };
        }).catch(() => {
          setValue((current) => (current === '' ? draft : current));
        });
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
          onChange={setValue}
          onCompositionChange={(composing) => {
            composingRef.current = composing;
          }}
        />
        <ListPicker
          lists={[...(lists ?? [])].sort(compareLists)}
          value={savedLists.find((list) => list.id === listId)?.id ?? ''}
          onChange={(selectedId) => {
            setListId(selectedId || null);
          }}
        />
        <button
          type="submit"
          disabled={!prepared.task || data === undefined}
          className="min-h-12 shrink-0 rounded-xl border border-transparent bg-transparent px-4 text-sm font-semibold text-ink hover:text-accent-ink disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:text-ink-faint"
        >
          {TEXTS.quickAddSubmit}
        </button>
      </div>
      <p id={`${id}-hint`} className="hidden text-xs leading-5 text-ink-muted md:block">
        {TEXTS.quickAddHint}
      </p>
      {issue && (
        <p id={`${id}-issue`} className="text-xs text-danger">
          {issue}
        </p>
      )}
    </form>
  );
}
