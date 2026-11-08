import type { TaskRead } from '../../api/schema';
import { LIST_TITLES, TEXTS } from '../../constants/texts';
import { SMART_LISTS, countLists, countTags } from '../../domain/smartLists';
import { sameView, serializeLocation, type AppLocation, type View } from '../../domain/view';
import { SidebarLink } from './SidebarLink';
import { SmartListIcon } from './SmartListIcon';

interface SidebarProps {
  /** Undefined while the list is loading or failed: counts are hidden then. */
  tasks: readonly TaskRead[] | undefined;
  now: Date;
  location: AppLocation;
  onNavigate: (view: View) => void;
}

export function Sidebar({ tasks, now, location, onNavigate }: SidebarProps) {
  const listCounts = tasks ? countLists(tasks, now) : undefined;
  const tagCounts = tasks ? countTags(tasks) : [];
  // Links keep the search; switching the view closes the open task.
  const hrefFor = (view: View) =>
    serializeLocation({ view, query: location.query, taskId: null }) || '/';

  return (
    <div className="flex flex-col gap-6 px-3 py-4">
      <span className="px-2.5 text-sm font-semibold">{TEXTS.appTitle}</span>

      <nav aria-label={TEXTS.smartLists}>
        <ul className="flex flex-col gap-0.5">
          {SMART_LISTS.map((list) => {
            const view: View = { kind: 'list', list };
            return (
              <li key={list}>
                <SidebarLink
                  href={hrefFor(view)}
                  active={sameView(view, location.view)}
                  onNavigate={() => {
                    onNavigate(view);
                  }}
                  icon={<SmartListIcon list={list} />}
                  label={LIST_TITLES[list]}
                  // Completed grows forever; a count there is noise.
                  count={list === 'completed' ? undefined : listCounts?.[list]}
                  urgent={list === 'overdue'}
                />
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-labelledby="sidebar-tags-heading">
        <h2
          id="sidebar-tags-heading"
          className="px-2.5 pb-1 text-xs font-medium tracking-wide text-ink-faint uppercase"
        >
          {TEXTS.tags}
        </h2>
        {tasks && tagCounts.length === 0 ? (
          <p className="px-2.5 text-xs text-ink-faint">{TEXTS.tagsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {tagCounts.map(({ tag, count }) => {
              const view: View = { kind: 'tag', tag };
              return (
                <li key={tag}>
                  <SidebarLink
                    href={hrefFor(view)}
                    active={sameView(view, location.view)}
                    onNavigate={() => {
                      onNavigate(view);
                    }}
                    icon={
                      <span aria-hidden="true" className="w-4 text-center text-ink-faint">
                        #
                      </span>
                    }
                    label={tag}
                    count={count}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}
