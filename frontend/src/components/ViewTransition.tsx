import { AnimatePresence } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

import { ViewFrame } from './ViewFrame';

/** Search text and task selection deliberately are not part of viewKey. */
export function ViewTransition({
  viewKey,
  day,
  children,
}: {
  viewKey: string;
  day: string;
  children: ReactNode;
}) {
  const previous = useRef({ key: viewKey, day, direction: 1 });
  if (previous.current.key !== viewKey)
    previous.current = { key: viewKey, day, direction: day < previous.current.day ? -1 : 1 };
  return (
    <div className="relative">
      <AnimatePresence initial={false} custom={previous.current.direction}>
        <ViewFrame key={viewKey} direction={previous.current.direction}>
          {children}
        </ViewFrame>
      </AnimatePresence>
    </div>
  );
}
