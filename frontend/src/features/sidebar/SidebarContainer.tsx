import { useUiStore } from '../../store/uiStore';
import { useAppLocation } from '../navigation/useAppLocation';
import { useTasks } from '../tasks/useTasks';
import { useNow } from '../time/useNow';
import { Sidebar } from './Sidebar';

/** Wires the sidebar to server data, the clock and the URL. */
export function SidebarContainer() {
  const { data } = useTasks();
  const now = useNow();
  const [location, navigate] = useAppLocation();
  const closeDrawer = useUiStore((state) => state.closeDrawer);

  return (
    <Sidebar
      tasks={data}
      now={now}
      location={location}
      onNavigate={(view) => {
        navigate({ view, taskId: null });
        closeDrawer();
      }}
    />
  );
}
