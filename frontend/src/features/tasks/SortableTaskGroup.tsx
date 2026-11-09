import { useEffect, type ReactNode } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { TaskRead } from '../../api/schema';
import { D_TEXTS } from '../../constants/texts';
import { useUiStore } from '../../store/uiStore';

interface Props {
  tasks: readonly TaskRead[];
  onMove: (id: string, index: number) => void;
  children: ReactNode;
}

export function SortableTaskGroup({ tasks, onMove, children }: Props) {
  const setDragging = useUiStore((state) => state.setDragging);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 230, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  useEffect(
    () => () => {
      setDragging(false);
    },
    [setDragging],
  );
  const title = (id: string | number) => tasks.find((task) => task.id === id)?.title ?? '';
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        screenReaderInstructions: { draggable: D_TEXTS.dragInstructions },
        announcements: {
          onDragStart: ({ active }) => D_TEXTS.dragStart(title(active.id)),
          onDragOver: ({ active, over }) =>
            over
              ? D_TEXTS.dragOver(
                  title(active.id),
                  tasks.findIndex((task) => task.id === over.id) + 1,
                  tasks.length,
                )
              : undefined,
          onDragEnd: ({ active }) => D_TEXTS.dragEnd(title(active.id)),
          onDragCancel: () => D_TEXTS.dragCancel,
        },
      }}
      onDragStart={() => {
        setDragging(true);
      }}
      onDragCancel={() => {
        setDragging(false);
      }}
      onDragEnd={({ active, over }) => {
        setDragging(false);
        if (over && active.id !== over.id)
          onMove(
            String(active.id),
            tasks.findIndex((task) => task.id === over.id),
          );
      }}
    >
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
