import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';

import { GripIcon } from '../../components/icons/GripIcon';
import { DRAG_TEXTS } from '../../constants/texts';

interface DragHandleProps {
  title: string;
  activatorRef: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  disabled: boolean;
}

/** The grip a task row is dragged by; by keyboard: Space/Enter, arrows, Escape. */
export function DragHandle({
  title,
  activatorRef,
  attributes,
  listeners,
  disabled,
}: DragHandleProps) {
  return (
    <button
      type="button"
      ref={activatorRef}
      {...attributes}
      {...listeners}
      aria-label={DRAG_TEXTS.dragHandle(title)}
      aria-roledescription={DRAG_TEXTS.sortable}
      data-shortcut-arrows
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        event.stopPropagation();
      }}
      className="task-grip flex min-h-11 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink-faint active:cursor-grabbing"
    >
      <GripIcon />
    </button>
  );
}
