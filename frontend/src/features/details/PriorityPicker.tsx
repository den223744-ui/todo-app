import { useId } from 'react';

import { EDIT_TEXTS, PRIORITY_LABELS } from '../../constants/texts';

const OPTIONS = [0, 1, 2, 3] as const;

interface PriorityPickerProps {
  value: number;
  onChange: (priority: number) => void;
}

/** Native radio buttons: arrow keys and screen readers work out of the box. */
export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-ink-muted">{EDIT_TEXTS.priority}</legend>
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((priority) => (
          <label
            key={priority}
            className="cursor-pointer rounded-lg border border-line px-2.5 py-1.5 text-xs has-checked:border-accent-ink has-checked:bg-accent-soft has-checked:text-accent-ink has-focus-visible:outline-2 has-focus-visible:outline-accent-ink"
          >
            <input
              type="radio"
              name={name}
              value={priority}
              checked={value === priority}
              onChange={() => {
                onChange(priority);
              }}
              className="sr-only"
            />
            {priority === 0 ? EDIT_TEXTS.priorityNone : PRIORITY_LABELS[priority]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
