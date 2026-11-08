/**
 * What the screen shows, as kept in the URL query string (SPEC: the active
 * list / tag / search live in the URL):
 *
 *   ?list=upcoming        a smart list (today is the default and is omitted)
 *   ?tag=дом              a tag list (wins over list when both are present)
 *   ?listId=<id>          one of the user's lists (after tag, before list)
 *   &q=молоко             search text
 *   &task=<id>            the task open in the detail panel
 *
 * Unknown or malformed values fall back to the defaults, so any URL is valid.
 */
import { isSmartList, type SmartList } from './smartLists';
import { normalizeTag } from './tags';

export type View =
  | { kind: 'list'; list: SmartList }
  | { kind: 'tag'; tag: string }
  | { kind: 'taskList'; listId: string };

export interface AppLocation {
  view: View;
  query: string;
  taskId: string | null;
}

export const DEFAULT_LIST: SmartList = 'today';

export const DEFAULT_LOCATION: AppLocation = {
  view: { kind: 'list', list: DEFAULT_LIST },
  query: '',
  taskId: null,
};

export function parseLocation(search: string): AppLocation {
  const params = new URLSearchParams(search);
  const tag = normalizeTag(params.get('tag') ?? '');
  const list = params.get('list') ?? '';
  const listId = params.get('listId')?.trim() ?? '';
  const view: View = tag
    ? { kind: 'tag', tag }
    : listId
      ? { kind: 'taskList', listId }
      : { kind: 'list', list: isSmartList(list) ? list : DEFAULT_LIST };
  return {
    view,
    query: params.get('q')?.trim() ?? '',
    taskId: params.get('task') || null,
  };
}

/** '?list=…&q=…' with defaults left out; '' for the default location. */
export function serializeLocation(location: AppLocation): string {
  const params = new URLSearchParams();
  const { view } = location;
  if (view.kind === 'tag') params.set('tag', view.tag);
  else if (view.kind === 'taskList') params.set('listId', view.listId);
  else if (view.list !== DEFAULT_LIST) params.set('list', view.list);
  const query = location.query.trim();
  if (query) params.set('q', query);
  if (location.taskId) params.set('task', location.taskId);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function sameView(a: View, b: View): boolean {
  switch (a.kind) {
    case 'tag':
      return b.kind === 'tag' && a.tag === b.tag;
    case 'taskList':
      return b.kind === 'taskList' && a.listId === b.listId;
    case 'list':
      return b.kind === 'list' && a.list === b.list;
  }
}
