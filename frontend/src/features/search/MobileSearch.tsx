import { useId, useRef, useState } from 'react';

import { CloseIcon } from '../../components/icons/CloseIcon';
import { IconButton } from '../../components/IconButton';
import { SEARCH_TEXTS } from '../../constants/texts';
import { useAppLocation } from '../navigation/useAppLocation';
import { SearchField } from './SearchField';

export function MobileSearch() {
  const [location, navigate] = useAppLocation();
  const [open, setOpen] = useState(Boolean(location.query));
  const trigger = useRef<HTMLDivElement>(null);
  const id = useId();
  const expanded = open || Boolean(location.query);
  const close = () => {
    setOpen(false);
    trigger.current?.querySelector('button')?.focus();
  };
  return (
    <>
      <div ref={trigger}>
        <IconButton
          label={SEARCH_TEXTS.open}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => {
            setOpen(true);
          }}
        >
          <svg
            className="size-5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" />
          </svg>
        </IconButton>
      </div>
      {expanded && (
        <div id={id} className="order-last flex w-full min-w-0 items-center gap-1 pt-1">
          <SearchField focusOnMount onEmptyEscape={close} />
          <IconButton
            label={SEARCH_TEXTS.close}
            className="shrink-0"
            onClick={() => {
              if (location.query) navigate({ query: '' }, { replace: true });
              else close();
            }}
          >
            <CloseIcon />
          </IconButton>
        </div>
      )}
    </>
  );
}
