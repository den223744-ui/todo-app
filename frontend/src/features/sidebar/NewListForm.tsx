import { useState } from 'react';

import { TEXTS } from '../../constants/texts';

/** "+ Новый список": a button that turns into a name field; Enter creates, Esc cancels. */
export function NewListForm({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-muted hover:bg-subtle hover:text-ink"
      >
        <span aria-hidden="true" className="w-4 text-center">
          +
        </span>
        {TEXTS.newList}
      </button>
    );
  }

  const close = () => {
    setOpen(false);
    setName('');
  };
  return (
    <input
      autoFocus
      type="text"
      value={name}
      maxLength={100}
      aria-label={TEXTS.newListName}
      placeholder={TEXTS.newListName}
      onChange={(event) => {
        setName(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault();
          if (name.trim()) onCreate(name.trim());
          close();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
      onBlur={close}
      className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm placeholder:text-ink-faint"
    />
  );
}
