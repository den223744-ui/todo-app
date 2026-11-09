import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';

import type { TaskListRead, TaskRead, TaskUpdate } from '../../api/schema';
import { GripIcon } from '../../components/icons/GripIcon';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { TaskTitle } from '../../components/TaskTitle';
import { useInertOnExit } from '../../components/useInertOnExit';
import { TEXTS, DRAG_TEXTS } from '../../constants/texts';
import { toLocalDateString } from '../../domain/dates';
import { isOverdue } from '../../domain/smartLists';
import { subtaskProgress } from '../../domain/subtasks';
import { serializeLocation, type AppLocation } from '../../domain/view';
import { useUiStore } from '../../store/uiStore';

import { InlineSubtasks } from './InlineSubtasks';
import { InlineTitleEditor } from './InlineTitleEditor';
import { PriorityMark } from './PriorityMark';
import { OPTIMISTIC_ID_PREFIX } from './taskMutations';

interface TaskRowProps {
  sortable?: boolean;
  layoutVersion?: string;
  task: TaskRead;
  now: Date;
  location: AppLocation;
  /** This task has a write in flight: a second toggle would race the first. */
  busy: boolean;
  onToggle: (task: TaskRead) => void;
  onOpen: (id: string) => void;
  /** The title is being edited in place (double click on it). */
  editing: boolean;
  onStartEdit: (id: string) => void;
  onRename: (task: TaskRead, patch: TaskUpdate) => void;
  onStopEdit: () => void;
  /** The task's list, for the coloured chip. */
  list?: TaskListRead | undefined;
  /** Shown as a bin button on the open row. */
  onDelete?: ((task: TaskRead) => void) | undefined;
  subtasks?: readonly TaskRead[];
  busyIds?: ReadonlySet<string>;
  timeOnly?: boolean;
  onMoveToToday?: ((task: TaskRead) => void) | undefined;
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

export function TaskRow({
  task,
  now,
  location,
  busy,
  onToggle,
  onOpen,
  editing,
  onStartEdit,
  onRename,
  onStopEdit,
  list,
  onDelete,
  subtasks = [],
  busyIds = new Set(),
  timeOnly = false,
  onMoveToToday,
  sortable = false,
  layoutVersion,
}: TaskRowProps) {
  const reducedMotion = useReducedMotion();
  const { ref: rowRef, present } = useInertOnExit<HTMLLIElement>();
  const subtasksId = useId();
  const expanded = useUiStore((state) => state.expandedTaskIds.has(task.id));
  const toggleSubtasks = useUiStore((state) => state.toggleSubtasks);
  const progress = subtaskProgress(subtasks);
  const completed = task.completed_at !== null;
  const overdue = isOverdue(task, toLocalDateString(now));
  const selectedId = useUiStore((state) => state.selectedTaskId);
  const selectTask = useUiStore((state) => state.selectTask);
  const dragging = useUiStore((state) => state.dragging);
  const reorderBusy = useUiStore((state) => state.reorderBusy);
  const selected = (selectedId ?? location.taskId) === task.id;
  // The bin follows the open task, not the keyboard selection: selection changes
  // on mousedown (focus), and a button appearing then would shift the row under
  // the pointer, so the click would land elsewhere (or on the bin itself).
  const open = location.taskId === task.id;
  const sort = useSortable({
    id: task.id,
    disabled: !sortable || busy || reorderBusy || task.id.startsWith(OPTIMISTIC_ID_PREFIX),
    animateLayoutChanges: () => false,
    transition: reducedMotion ? null : { duration: 180, easing: 'ease' },
  });
  const linkRef = useRef<HTMLAnchorElement>(null);
  const wasEditing = useRef(editing);

  // After inline editing ends, keyboard focus returns to the task.
  useEffect(() => {
    if (wasEditing.current && !editing) linkRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  // Not saved yet: the id is temporary and the API does not know it, so the
  // task cannot be opened, renamed or completed until the server answers.
  const unsaved = task.id.startsWith(OPTIMISTIC_ID_PREFIX);
  const locked = busy || unsaved;
  const today = toLocalDateString(now);
  const content = (
    // A narrow list (phone, or the middle column beside the timeline): the title
    // gets its own line, the date goes under it. By the list's width, not the window's.
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 @md:flex-nowrap">
      <span className="flex min-w-0 flex-1 basis-full items-center gap-2 @md:basis-auto">
        <TaskTitle
          completed={completed}
          className="min-w-0 text-[13.5px] leading-5 wrap-break-word"
        >
          {task.title}
        </TaskTitle>
        {task.priority > 0 && <PriorityMark priority={task.priority} />}
      </span>
      {(list || task.tags.length > 0) && (
        <span className="hidden max-w-[45%] flex-wrap justify-end gap-1.5 @md:flex">
          {list && (
            <span
              className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                borderColor: `var(--list-${list.color})`,
                color: `var(--list-${list.color}-ink)`,
              }}
            >
              {list.name}
            </span>
          )}
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="max-w-full rounded-full border border-line px-2.5 py-0.5 text-[11px] text-ink-muted wrap-anywhere"
            >
              #{tag}
            </span>
          ))}
        </span>
      )}
      {task.due_date && (!timeOnly || task.due_time) && (
        <time
          dateTime={task.due_time ? `${task.due_date}T${task.due_time}` : task.due_date}
          className={`shrink-0 text-left text-xs tabular-nums @md:w-24 @md:text-right ${overdue ? 'text-danger' : 'text-ink-muted'}`}
        >
          {timeOnly || task.due_date === today
            ? (task.due_time?.slice(0, 5) ?? '')
            : `${dateFormat.format(new Date(`${task.due_date}T00:00:00`))}${
                task.due_time ? `, ${task.due_time.slice(0, 5)}` : ''
              }`}
        </time>
      )}
    </span>
  );

  return (
    <motion.li
      initial={reducedMotion || dragging ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={reducedMotion || dragging ? {} : { height: 0, opacity: 0 }}
      transition={{ duration: reducedMotion || dragging ? 0 : 0.2, ease: 'easeOut' }}
      aria-hidden={!present || undefined}
      ref={(element) => {
        sort.setNodeRef(element);
        rowRef.current = element;
      }}
      data-task-row={task.id}
      style={{
        transform: CSS.Transform.toString(sort.transform),
        transition: reducedMotion ? undefined : sort.transition,
        position: 'relative',
        zIndex: sort.isDragging ? 10 : undefined,
        boxShadow: sort.isDragging ? '0 0 0 1px var(--check), var(--shadow-soft)' : undefined,
      }}
      onFocus={() => {
        selectTask(task.id);
      }}
      className={`group/task overflow-clip rounded-xl ${sort.isDragging ? 'bg-surface' : ''}`}
    >
      <motion.div
        layout={reducedMotion || dragging ? false : 'position'}
        layoutDependency={layoutVersion}
        transition={{ layout: { type: 'tween', duration: 0.22, ease: 'easeOut' } }}
        className={
          selected ? 'rounded-xl outline-1 -outline-offset-1 outline-check' : 'hover:bg-subtle'
        }
      >
        <div
          className="flex items-center"
          onDoubleClick={(event) => {
            // On the whole row: the first click opens the details and narrows the
            // list, so the second click may land beside the title, e.g. on the bin.
            if (unsaved || editing) return;
            if ((event.target as Element).closest('input, [aria-expanded], .task-grip')) return;
            event.preventDefault();
            onStartEdit(task.id);
          }}
        >
          {sortable && (
            <button
              type="button"
              ref={sort.setActivatorNodeRef}
              {...sort.attributes}
              {...sort.listeners}
              aria-label={DRAG_TEXTS.dragHandle(task.title)}
              aria-roledescription={DRAG_TEXTS.sortable}
              data-shortcut-arrows
              aria-disabled={locked || reorderBusy || undefined}
              onClick={(event) => {
                event.stopPropagation();
              }}
              className="task-grip flex min-h-11 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink-faint active:cursor-grabbing"
            >
              <GripIcon />
            </button>
          )}
          <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center pl-1">
            <TaskCheckbox
              checked={completed}
              // aria-disabled, not disabled: a disabled element loses keyboard focus.
              aria-disabled={locked || undefined}
              aria-label={completed ? TEXTS.reopenTask(task.title) : TEXTS.completeTask(task.title)}
              onChange={() => {
                if (!locked) onToggle(task);
              }}
            />
          </label>
          {unsaved ? (
            <div aria-busy="true" className="min-w-0 flex-1 py-2.5 pr-4 opacity-70">
              {content}
            </div>
          ) : editing ? (
            <div className="min-w-0 flex-1 py-1.5 pr-4">
              <InlineTitleEditor
                task={task}
                onSave={(patch) => {
                  onRename(task, patch);
                }}
                onDone={onStopEdit}
              />
            </div>
          ) : (
            <a
              ref={linkRef}
              data-task-link={present ? task.id : undefined}
              href={serializeLocation({ ...location, taskId: task.id })}
              aria-current={selected ? 'true' : undefined}
              onFocus={() => {
                selectTask(task.id);
              }}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                selectTask(task.id);
                onOpen(task.id);
              }}
              className="min-w-0 flex-1 rounded-lg py-2.5 pr-4"
            >
              {content}
            </a>
          )}
          {progress.total > 0 && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={expanded ? subtasksId : undefined}
              aria-label={TEXTS.subtasksToggle(progress.done, progress.total, expanded, task.title)}
              onClick={() => {
                toggleSubtasks(task.id);
              }}
              className="mr-1 flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs tabular-nums text-ink-muted hover:text-ink"
            >
              <span>
                {progress.done}/{progress.total}
              </span>
              <svg
                className="size-3.5"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={expanded ? 'm5 12 5-5 5 5' : 'm5 8 5 5 5-5'} />
              </svg>
            </button>
          )}
          {overdue && onMoveToToday && !unsaved && !editing && (
            <button
              type="button"
              aria-label={TEXTS.moveToTodayNamed(task.title)}
              aria-disabled={locked || undefined}
              onClick={(event) => {
                if (locked) return;
                const row = event.currentTarget.closest('li');
                const next =
                  row?.nextElementSibling?.querySelector<HTMLElement>('[data-task-link]') ??
                  row?.previousElementSibling?.querySelector<HTMLElement>('[data-task-link]');
                onMoveToToday(task);
                requestAnimationFrame(() => {
                  (
                    (linkRef.current?.closest('[aria-hidden="true"]') ? null : linkRef.current) ??
                    next ??
                    document.querySelector<HTMLElement>('[data-quick-add-input]')
                  )?.focus();
                });
              }}
              className={`task-row-action mr-2 min-h-11 shrink-0 rounded-lg px-2 text-xs text-ink-muted hover:text-accent-ink ${selected ? 'is-selected' : ''}`}
            >
              {TEXTS.moveToToday}
            </button>
          )}
          {open && onDelete && !unsaved && !editing && (
            <button
              type="button"
              aria-label={TEXTS.deleteTaskNamed(task.title)}
              onClick={(event) => {
                // Never delete on the second click of a double click (rename).
                if (event.detail > 1) return;
                onDelete(task);
              }}
              className="mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-danger"
            >
              <svg
                className="size-[18px]"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 6h12M8.2 6V4.4h3.6V6M5.6 6l.8 10h7.2l.8-10M8.6 9v4.4M11.4 9v4.4" />
              </svg>
            </button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {expanded && progress.total > 0 && (
            <motion.div
              key="subtasks"
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reducedMotion ? {} : { height: 0, opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.22 }}
              className="overflow-hidden"
            >
              <InlineSubtasks
                id={subtasksId}
                title={task.title}
                subtasks={subtasks}
                busyIds={busyIds}
                onToggle={onToggle}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.li>
  );
}
