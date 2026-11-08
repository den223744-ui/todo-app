import { EMPTY_LIST_TEXTS, TEXTS } from '../../constants/texts';
import type { AppLocation } from '../../domain/view';

export function TaskListEmpty({ location }: { location: AppLocation }) {
  const { title, hint } = location.query
    ? { title: TEXTS.searchEmpty, hint: TEXTS.searchEmptyHint }
    : location.view.kind === 'tag'
      ? { title: TEXTS.tagEmpty, hint: TEXTS.tagEmptyHint }
      : location.view.kind === 'taskList'
        ? { title: TEXTS.listEmpty, hint: TEXTS.listEmptyHint }
        : EMPTY_LIST_TEXTS[location.view.list];

  return (
    <div role="status" className="rounded-2xl px-5 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm text-ink-muted">{hint}</p>
    </div>
  );
}
