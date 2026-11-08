import { AppShell } from './components/AppShell';
import { greeting } from './constants/texts';
import { parseLocalDate, toLocalDateString } from './domain/dates';
import { TaskDetailsContainer } from './features/details/TaskDetailsContainer';
import { useLists } from './features/lists/useLists';
import { DayNav } from './features/navigation/DayNav';
import { useAppLocation } from './features/navigation/useAppLocation';
import { viewTitle } from './features/navigation/viewTitle';
import { SearchField } from './features/search/SearchField';
import { Toaster } from './features/toasts/Toaster';
import { UndoShortcut } from './features/toasts/UndoShortcut';
import { QuickAdd } from './features/quick-add/QuickAdd';
import { SidebarContainer } from './features/sidebar/SidebarContainer';
import { TaskListContainer } from './features/tasks/TaskListContainer';
import { TodayStats } from './features/tasks/TodayStats';
import { useTasks } from './features/tasks/useTasks';
import { useNow } from './features/time/useNow';
import { TimelineContainer } from './features/timeline/TimelineContainer';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function App() {
  const [location, navigate] = useAppLocation();
  const { data: lists } = useLists();
  const now = useNow();
  const { data: tasks } = useTasks();
  const title = viewTitle(location.view, lists);
  const isToday = location.view.kind === 'list' && location.view.list === 'today';
  const today = toLocalDateString(now);
  const day = location.day ?? today;

  // The right column: an open task's details, else the day's timeline on Today.
  const side = location.taskId ? <TaskDetailsContainer /> : isToday ? <TimelineContainer /> : null;

  return (
    <AppShell sidebar={<SidebarContainer />} details={side}>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-10 md:py-8">
        <div>
          <div className="flex flex-col-reverse gap-4 md:flex-row md:items-center md:justify-between">
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <svg
                className="size-5 text-accent"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 14h12M6.5 14a3.5 3.5 0 0 1 7 0M10 6.5V8M5.2 8.7l1 1M14.8 8.7l-1 1M3 11.5h1.5M15.5 11.5H17" />
              </svg>
              {greeting(now.getHours())}
            </p>
            <SearchField />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-display text-[34px] leading-tight font-extrabold tracking-tight text-ink first-letter:uppercase md:text-[42px]">
              {isToday ? (
                <>
                  {day === today && <span className="sr-only">{title}, </span>}
                  {dateFormat.format(parseLocalDate(day) ?? now)}
                </>
              ) : (
                title
              )}
            </h1>
            {isToday && (
              <DayNav
                day={day}
                today={today}
                onChange={(next) => {
                  navigate({ day: next, taskId: null });
                }}
              />
            )}
          </div>
        </div>
        {isToday && tasks && <TodayStats tasks={tasks} now={now} day={day} />}
        <QuickAdd />
        <TaskListContainer />
      </div>
      <Toaster />
      <UndoShortcut />
    </AppShell>
  );
}
