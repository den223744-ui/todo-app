import { TEXTS } from '../../constants/texts';

export function TaskListSkeleton() {
  return (
    <div role="status" aria-label={TEXTS.loadingTasks} className="space-y-2">
      <span className="sr-only">{TEXTS.loadingTasks}</span>
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex gap-3 rounded-lg border border-line p-4"
        >
          <div className="size-5 rounded-sm bg-subtle" />
          <div className="flex-1 space-y-3">
            <div className={`h-4 rounded bg-subtle ${index % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
            <div className="h-3 w-1/3 rounded bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}
