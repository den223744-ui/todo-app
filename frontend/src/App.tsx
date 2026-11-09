import { AnimatePresence } from 'framer-motion';
import { ViewTransition } from './components/ViewTransition';
import { AppShell } from './components/AppShell';
import { useMediaQuery } from './components/useMediaQuery';
import { useUiStore } from './store/uiStore';
import { greeting } from './constants/texts';
import { parseLocalDate, toLocalDateString } from './domain/dates';
import { TaskDetailsContainer } from './features/details/TaskDetailsContainer';
import { useLists } from './features/lists/useLists';
import { DayNav } from './features/navigation/DayNav';
import { useAppLocation } from './features/navigation/useAppLocation';
import { viewTitle } from './features/navigation/viewTitle';
import { SearchField } from './features/search/SearchField';
import { MobileSearch } from './features/search/MobileSearch';
import { DayViewTabs } from './features/tasks/DayViewTabs';
import { Toaster } from './features/toasts/Toaster';
import { UndoShortcut } from './features/toasts/UndoShortcut';
import { QuickAdd } from './features/quick-add/QuickAdd';
import { SidebarContainer } from './features/sidebar/SidebarContainer';
import { TaskListContainer } from './features/tasks/TaskListContainer';
import { TodayStats } from './features/tasks/TodayStats';
import { useTasks } from './features/tasks/useTasks';
import { useNow } from './features/time/useNow';
import { TimelineContainer } from './features/timeline/TimelineContainer';
import { GlobalShortcuts } from './features/shortcuts/GlobalShortcuts';
import { CommandPalette } from './features/shortcuts/CommandPalette';
import { ShortcutHelp } from './features/shortcuts/ShortcutHelp';
import { ThemeSync } from './features/theme/ThemeSync';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function App() {
  const mobile = useMediaQuery('(max-width: 767.98px)');
  const narrow = useMediaQuery('(max-width: 1023.98px)');
  const dayView = useUiStore((state) => state.dayView);
  const [location, navigate] = useAppLocation();
  const { data: lists } = useLists();
  const now = useNow();
  const { data: tasks } = useTasks();
  const title = viewTitle(location.view, lists);
  const isToday = location.view.kind === 'list' && location.view.list === 'today';
  const today = toLocalDateString(now);
  const day = location.day ?? today;
  const viewKey = JSON.stringify([location.view, day]);

  // The right column: an open task's details, else the day's timeline on Today.
  const side = (
    <>
      <AnimatePresence initial={false}>
        {location.taskId && <TaskDetailsContainer key="details" />}
      </AnimatePresence>
      {!location.taskId && isToday && <TimelineContainer />}
    </>
  );

  return (
    <AppShell
      sidebar={<SidebarContainer />}
      details={side}
      mobileSearch={mobile ? <MobileSearch /> : null}
    >
      <div className="mx-auto w-full max-w-4xl px-4 pt-3 pb-[calc(var(--quick-add-height,84px)+16px)] md:px-10 md:py-8">
        <div>
          <div className="flex flex-col-reverse gap-4 md:flex-row md:items-center md:justify-between">
            <p className="hidden items-center gap-2 text-sm text-ink-muted md:flex">
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
            {!mobile && <SearchField />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
            <ViewTransition viewKey={viewKey} day={day}>
              <h1
                tabIndex={-1}
                data-view-heading
                className="font-display text-[28px] leading-tight font-extrabold tracking-tight text-ink first-letter:uppercase md:text-[42px]"
              >
                {isToday ? (
                  <>
                    {day === today && <span className="sr-only">{title}, </span>}
                    {dateFormat.format(parseLocalDate(day) ?? now)}
                  </>
                ) : (
                  title
                )}
              </h1>
            </ViewTransition>
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
        {isToday && tasks && (
          <ViewTransition viewKey={viewKey} day={day}>
            <TodayStats tasks={tasks} now={now} day={day} />
          </ViewTransition>
        )}
        <QuickAdd />
        <ViewTransition viewKey={viewKey} day={day}>
          {isToday && narrow && !location.query.trim() ? (
            <>
              <DayViewTabs />
              <div
                role="tabpanel"
                id="day-panel-list"
                aria-labelledby="day-tab-list"
                hidden={dayView !== 'list'}
                tabIndex={0}
              >
                <TaskListContainer snapshot={location} />
              </div>
              <div
                role="tabpanel"
                id="day-panel-timeline"
                aria-labelledby="day-tab-timeline"
                hidden={dayView !== 'timeline'}
                tabIndex={0}
              >
                {dayView === 'timeline' && <TimelineContainer inline snapshot={location} />}
              </div>
            </>
          ) : (
            <TaskListContainer snapshot={location} />
          )}
        </ViewTransition>
      </div>
      {!(location.taskId && narrow) && <Toaster />}
      <UndoShortcut />
      <GlobalShortcuts />
      <CommandPalette />
      <ShortcutHelp />
      <ThemeSync />
    </AppShell>
  );
}
