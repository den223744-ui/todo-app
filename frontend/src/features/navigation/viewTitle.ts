import type { TaskListRead } from '../../api/schema';
import { LIST_TITLES, TEXTS } from '../../constants/texts';
import type { View } from '../../domain/view';

export function viewTitle(view: View, lists: readonly TaskListRead[] = []): string {
  switch (view.kind) {
    case 'list':
      return LIST_TITLES[view.list];
    case 'tag':
      return `#${view.tag}`;
    case 'taskList':
      return lists.find((list) => list.id === view.listId)?.name ?? TEXTS.listFallbackTitle;
  }
}
