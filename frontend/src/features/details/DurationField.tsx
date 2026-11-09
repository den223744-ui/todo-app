import { useId } from 'react';

import type { TaskRead, TaskUpdate } from '../../api/schema';
import { DURATION_TEXTS, durationLabel } from '../../constants/texts';

/** How long the task takes: its block height on the timeline. */
export function DurationField({
  task,
  onUpdate,
}: {
  task: TaskRead;
  onUpdate: (patch: TaskUpdate) => void;
}) {
  const id = useId();
  // A stored value outside the presets stays selectable.
  const options = [...new Set([...DURATION_TEXTS.options, task.duration_minutes ?? 15])].sort(
    (a, b) => a - b,
  );
  return (
    <div className="detail-property">
      <label htmlFor={id} className="text-xs text-ink-muted">
        {DURATION_TEXTS.label}
      </label>
      <select
        id={id}
        value={task.duration_minutes ?? ''}
        onChange={(event) => {
          const value = event.currentTarget.value;
          const minutes = value === '' ? null : Number(value);
          if (minutes !== task.duration_minutes) onUpdate({ duration_minutes: minutes });
        }}
        className="h-9 min-w-0 max-w-full rounded bg-transparent text-right text-sm"
      >
        <option value="">{DURATION_TEXTS.none}</option>
        {options.map((minutes) => (
          <option key={minutes} value={minutes}>
            {durationLabel(minutes)}
          </option>
        ))}
      </select>
    </div>
  );
}
