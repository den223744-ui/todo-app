import { useUiStore } from '../../store/uiStore';
import { useMutationState } from '@tanstack/react-query';
import { useCreateList, useLists, useUpdateList, useDeleteList } from '../lists/useLists';
import { listKeys } from '../lists/listQueries';
import { mutationTaskId } from '../tasks/taskMutations';
import { parseLocation } from '../../domain/view';
import { useAppLocation } from '../navigation/useAppLocation';
import { useTasks } from '../tasks/useTasks';
import { useNow } from '../time/useNow';
import { Sidebar } from './Sidebar';

/** Wires the sidebar to server data, the clock and the URL. */
export function SidebarContainer() {
  const { data } = useTasks();
  const { data: lists } = useLists();
  const createList = useCreateList();
  const updateList = useUpdateList();
  const deleteList = useDeleteList();
  const busyListIds = new Set(
    useMutationState({
      filters: { mutationKey: listKeys.mutation(), status: 'pending' },
      select: (mutation) => mutationTaskId(mutation.state.variables),
    }).filter((id): id is string => id !== null),
  );
  const now = useNow();
  const [location, navigate] = useAppLocation();
  const closeDrawer = useUiStore((state) => state.closeDrawer);

  return (
    <Sidebar
      tasks={data}
      lists={lists}
      now={now}
      location={location}
      onNavigate={(view) => {
        navigate({ view, taskId: null });
        closeDrawer();
      }}
      onCreateList={(name) => {
        createList.mutate({ name });
      }}
      busyListIds={busyListIds}
      onUpdateList={(id, patch) => {
        updateList.mutate({ id, patch });
      }}
      onDeleteList={(id) => {
        closeDrawer();
        void deleteList.mutateAsync(id).then(
          () => {
            const current = parseLocation(window.location.search);
            if (current.view.kind === 'taskList' && current.view.listId === id)
              navigate({
                view: { kind: 'list', list: 'today' },
                taskId: null,
                query: '',
                day: null,
              });
          },
          () => undefined,
        );
      }}
    />
  );
}
