import { AppShell } from './components/AppShell';
import { TaskDetailsContainer } from './features/details/TaskDetailsContainer';
import { useLists } from './features/lists/useLists';
import { useAppLocation } from './features/navigation/useAppLocation';
import { viewTitle } from './features/navigation/viewTitle';
import { SearchField } from './features/search/SearchField';
import { Toaster } from './features/toasts/Toaster';
import { QuickAdd } from './features/quick-add/QuickAdd';
import { SidebarContainer } from './features/sidebar/SidebarContainer';
import { TaskListContainer } from './features/tasks/TaskListContainer';

export function App() {
  const [location] = useAppLocation();
  const { data: lists } = useLists();

  return (
    <AppShell sidebar={<SidebarContainer />} details={<TaskDetailsContainer />}>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {viewTitle(location.view, lists)}
          </h1>
          <SearchField />
        </div>
        <QuickAdd />
        <TaskListContainer />
      </div>
      <Toaster />
    </AppShell>
  );
}
