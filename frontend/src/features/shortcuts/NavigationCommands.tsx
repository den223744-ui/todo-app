import { Command } from 'cmdk';
import type { TaskListRead, TaskRead } from '../../api/schema';
import { LIST_TITLES, PALETTE_TEXTS } from '../../constants/texts';
import { addDays, toLocalDateString } from '../../domain/dates';
import { countTags, SMART_LISTS } from '../../domain/smartLists';
import { compareLists } from '../../domain/taskLists';
import type { View } from '../../domain/view';
import { OPTIMISTIC_ID_PREFIX } from '../tasks/taskMutations';

interface Props {
  tasks: readonly TaskRead[];
  lists: readonly TaskListRead[];
  onGo: (view: View, day?: string) => void;
}

export function NavigationCommands({ tasks, lists, onGo }: Props) {
  return (
    <Command.Group heading={PALETTE_TEXTS.go}>
      {SMART_LISTS.map((list) => (
        <Command.Item
          key={list}
          value={`go-${list}`}
          keywords={[LIST_TITLES[list]]}
          onSelect={() => {
            onGo({ kind: 'list', list });
          }}
        >
          {LIST_TITLES[list]}
        </Command.Item>
      ))}
      <Command.Item
        value="go-tomorrow"
        keywords={[PALETTE_TEXTS.tomorrowView]}
        onSelect={() => {
          onGo({ kind: 'list', list: 'today' }, toLocalDateString(addDays(new Date(), 1)));
        }}
      >
        {PALETTE_TEXTS.tomorrowView}
      </Command.Item>
      {[...lists]
        .sort(compareLists)
        .filter((list) => !list.id.startsWith(OPTIMISTIC_ID_PREFIX))
        .map((list) => (
          <Command.Item
            key={list.id}
            value={`list-${list.id}`}
            keywords={[list.name]}
            onSelect={() => {
              onGo({ kind: 'taskList', listId: list.id });
            }}
          >
            <span
              aria-hidden="true"
              className="mr-2 inline-block size-2 rounded-full"
              style={{ backgroundColor: `var(--list-${list.color})` }}
            />
            {list.name}
          </Command.Item>
        ))}
      {countTags(tasks).map(({ tag }) => (
        <Command.Item
          key={tag}
          value={`tag-${tag}`}
          onSelect={() => {
            onGo({ kind: 'tag', tag });
          }}
        >
          #{tag}
        </Command.Item>
      ))}
    </Command.Group>
  );
}
