import type { ReactNode } from 'react';

import type { TaskListRead, TaskRead, TaskListUpdate } from '../../api/schema';
import { BrandLogo } from '../../components/BrandLogo';
import { LIST_TITLES, TEXTS, SHORTCUT_TEXTS } from '../../constants/texts';
import { countLists, countTags, type SmartList } from '../../domain/smartLists';
import { compareLists, countByList } from '../../domain/taskLists';
import { sameView, serializeLocation, type AppLocation, type View } from '../../domain/view';
import { useUiStore } from '../../store/uiStore';
import { OPTIMISTIC_ID_PREFIX } from '../tasks/taskMutations';
import { ThemePicker } from '../theme/ThemePicker';

import { ListFolderIcon } from './ListFolderIcon';
import { NewListForm } from './NewListForm';
import { SidebarLink } from './SidebarLink';
import { SidebarListItem } from './SidebarListItem';
import { SmartListIcon } from './SmartListIcon';

/** Today first, as in the mockup. */
const NAV_ORDER: readonly SmartList[] = ['today', 'inbox', 'upcoming', 'overdue', 'completed'];

interface SidebarProps {
  /** Undefined while the list is loading or failed: counts are hidden then. */
  tasks: readonly TaskRead[] | undefined;
  lists?: readonly TaskListRead[] | undefined;
  now: Date;
  location: AppLocation;
  onNavigate: (view: View) => void;
  onCreateList?: (name: string) => void;
  onUpdateList?: (id: string, patch: TaskListUpdate) => void;
  onDeleteList?: (id: string) => void;
  busyListIds?: ReadonlySet<string>;
}

export function Sidebar({
  tasks,
  lists = [],
  now,
  location,
  onNavigate,
  onCreateList,
  onUpdateList,
  onDeleteList,
  busyListIds = new Set(),
}: SidebarProps) {
  const listCounts = tasks ? countLists(tasks, now) : undefined;
  const tagCounts = tasks ? countTags(tasks) : [];
  const perList = tasks ? countByList(tasks) : undefined;
  // Links keep the search; switching the view closes the open task.
  const hrefFor = (view: View) =>
    serializeLocation({ view, query: location.query, taskId: null }) || '/';
  const link = (view: View, icon: ReactNode, label: string, count?: number) => (
    <SidebarLink
      href={hrefFor(view)}
      active={sameView(view, location.view)}
      onNavigate={() => {
        onNavigate(view);
      }}
      icon={icon}
      label={label}
      count={count}
      urgent={view.kind === 'list' && view.list === 'overdue'}
    />
  );

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-7 px-4 pt-6 pb-4">
        <BrandLogo className="self-start px-3 text-xl" />

        <nav aria-label={TEXTS.smartLists}>
          <ul className="flex flex-col gap-1">
            {NAV_ORDER.map((list) => (
              <li key={list}>
                {link(
                  { kind: 'list', list },
                  <SmartListIcon list={list} />,
                  LIST_TITLES[list],
                  // Completed grows forever; a count there is noise.
                  list === 'completed' ? undefined : listCounts?.[list],
                )}
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="sidebar-lists-heading">
          <h2 id="sidebar-lists-heading" className="px-3 pb-2 text-sm text-ink-faint">
            {TEXTS.favorites}
          </h2>
          <ul className="flex flex-col gap-1">
            {[...lists].sort(compareLists).map((list) =>
              // Not saved yet: there is no server id to open.
              list.id.startsWith(OPTIMISTIC_ID_PREFIX) ? (
                <li
                  key={list.id}
                  aria-busy="true"
                  className="flex items-center gap-3.5 px-3 py-2.5 text-[15px] text-ink-faint"
                >
                  <ListFolderIcon color={list.color} />
                  <span className="min-w-0 flex-1 truncate">{list.name}</span>
                </li>
              ) : (
                <SidebarListItem
                  key={list.id}
                  list={list}
                  href={hrefFor({ kind: 'taskList', listId: list.id })}
                  active={sameView({ kind: 'taskList', listId: list.id }, location.view)}
                  count={perList?.get(list.id)}
                  busy={busyListIds.has(list.id)}
                  onNavigate={() => {
                    onNavigate({ kind: 'taskList', listId: list.id });
                  }}
                  onUpdate={
                    onUpdateList
                      ? (patch) => {
                          onUpdateList(list.id, patch);
                        }
                      : undefined
                  }
                  onDelete={
                    onDeleteList
                      ? () => {
                          onDeleteList(list.id);
                        }
                      : undefined
                  }
                />
              ),
            )}
            {onCreateList && (
              <li>
                <NewListForm onCreate={onCreateList} />
              </li>
            )}
          </ul>
        </nav>

        <nav aria-labelledby="sidebar-tags-heading">
          <h2 id="sidebar-tags-heading" className="px-3 pb-2 text-sm text-ink-faint">
            {TEXTS.tags}
          </h2>
          {tasks && tagCounts.length === 0 ? (
            <p className="px-3 text-sm text-ink-faint">{TEXTS.tagsEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {tagCounts.map(({ tag, count }) => (
                <li key={tag}>
                  {link(
                    { kind: 'tag', tag },
                    <span
                      aria-hidden="true"
                      className="w-[22px] text-center text-lg font-bold text-ink-faint"
                    >
                      #
                    </span>,
                    tag,
                    count,
                  )}
                </li>
              ))}
            </ul>
          )}
        </nav>
      </div>
      <footer className="mt-auto flex flex-col items-start gap-3 border-t border-line px-7 py-4">
        <ThemePicker />
        <button
          type="button"
          onClick={() => {
            useUiStore.getState().setHelpOpen(true);
          }}
          className="hidden min-h-11 items-center gap-2 rounded-lg border border-line px-2.5 text-xs text-ink-muted hover:text-ink md:flex"
        >
          <span aria-hidden="true">?</span>
          {SHORTCUT_TEXTS.help}
        </button>
      </footer>
    </div>
  );
}
