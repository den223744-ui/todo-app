import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';

import type { TaskListRead, TaskRead, TaskUpdate } from '../../api/schema';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { useInertOnExit } from '../../components/useInertOnExit';
import { TEXTS } from '../../constants/texts';
import { toLocalDateString } from '../../domain/dates';
import { isOverdue } from '../../domain/smartLists';
import { subtaskProgress } from '../../domain/subtasks';
import { serializeLocation, type AppLocation } from '../../domain/view';
import { useUiStore } from '../../store/uiStore';

import { DeleteRowButton } from './DeleteRowButton';
import { DragHandle } from './DragHandle';
import { InlineSubtasks } from './InlineSubtasks';
import { InlineTitleEditor } from './InlineTitleEditor';
import { MoveToTodayButton } from './MoveToTodayButton';
import { SubtasksToggle } from './SubtasksToggle';
import { OPTIMISTIC_ID_PREFIX } from './taskMutations';
import { TaskRowSummary } from './TaskRowSummary';

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
  const content = <TaskRowSummary task={task} now={now} list={list} timeOnly={timeOnly} />;

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
            <DragHandle
              title={task.title}
              activatorRef={sort.setActivatorNodeRef}
              attributes={sort.attributes}
              listeners={sort.listeners}
              disabled={locked || reorderBusy}
            />
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
            <SubtasksToggle
              title={task.title}
              done={progress.done}
              total={progress.total}
              expanded={expanded}
              controls={subtasksId}
              onToggle={() => {
                toggleSubtasks(task.id);
              }}
            />
          )}
          {overdue && onMoveToToday && !unsaved && !editing && (
            <MoveToTodayButton
              title={task.title}
              locked={locked}
              selected={selected}
              linkRef={linkRef}
              onMove={() => {
                onMoveToToday(task);
              }}
            />
          )}
          {open && onDelete && !unsaved && !editing && (
            <DeleteRowButton
              title={task.title}
              onDelete={() => {
                onDelete(task);
              }}
            />
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
