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
        className="nav-glow-hover flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-[15px] text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true" className="w-[22px] text-center text-2xl leading-none font-bold">
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
      className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] placeholder:text-ink-faint"
    />
  );
}
