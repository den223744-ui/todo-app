import { useId } from 'react';

import { EDIT_TEXTS } from '../../constants/texts';

const OPTIONS = [0, 1, 2, 3] as const;

interface PriorityPickerProps {
  value: number;
  onChange: (priority: number) => void;
}

/** Native radio buttons: arrow keys and screen readers work out of the box. */
export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  const name = useId();
  return (
    <div className="detail-property">
      <span id={`${name}-label`} className="text-xs text-ink-muted">
        {EDIT_TEXTS.priority}
      </span>
      <fieldset aria-labelledby={`${name}-label`} className="min-w-0">
        <div className="flex justify-end gap-1">
          {OPTIONS.map((priority) => (
            <label
              key={priority}
              className="flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-line px-2 text-xs has-checked:border-check has-checked:text-check has-focus-visible:outline-2 has-focus-visible:outline-check"
            >
              <input
                type="radio"
                name={name}
                value={priority}
                aria-label={EDIT_TEXTS.priorityNames[priority]}
                checked={value === priority}
                onChange={() => {
                  onChange(priority);
                }}
                className="sr-only"
              />
              <span aria-hidden="true">
                {priority === 0 ? EDIT_TEXTS.priorityNone : '!'.repeat(priority)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
