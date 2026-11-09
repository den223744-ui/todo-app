import { toLocalDateString } from '../../domain/dates';
import { useLists } from '../lists/useLists';
import { useAppLocation } from '../navigation/useAppLocation';
import { useTasks } from '../tasks/useTasks';
import { useNow } from '../time/useNow';
import { Timeline } from './Timeline';
import { useTimelineMove } from './useTimelineMove';

/**
 * The right column on wide screens while no task is open: the timeline of the
 * day the Today screen shows. A task opened from it takes its place.
 */
export function TimelineContainer({ inline = false }: { inline?: boolean }) {
  const actions = useTimelineMove();
  const { data } = useTasks();
  const { data: lists } = useLists();
  const now = useNow();
  const [location, navigate] = useAppLocation();
  const today = toLocalDateString(now);

  return (
    <aside
      className={
        inline
          ? 'mt-4 flex min-w-0 flex-col rounded-2xl border border-line'
          : 'hidden min-h-0 lg:my-4 lg:mr-4 lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:rounded-2xl lg:border lg:border-line'
      }
    >
      <Timeline
        ready={data !== undefined}
        onMove={actions.move}
        onShift={actions.shift}
        tasks={data ?? []}
        lists={lists ?? []}
        day={location.day ?? today}
        today={today}
        now={now}
        showLabel={!inline}
        onOpen={(taskId) => {
          navigate({ taskId });
        }}
      />
    </aside>
  );
}
