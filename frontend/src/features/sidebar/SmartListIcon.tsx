import type { ReactNode } from 'react';

import type { SmartList } from '../../domain/smartLists';

/*
 * Hand-drawn set for the smart lists, one style throughout: a 20px grid,
 * rounded 1.6 strokes, and a soft tinted shape behind the line (duotone) so
 * each icon reads at a glance.
 */
const soft = { fill: 'currentColor', opacity: 0.16, stroke: 'none' } as const;

const ICONS: Record<SmartList, ReactNode> = {
  // Today: a sun with uneven rays.
  today: (
    <>
      <circle cx="10" cy="10" r="3.6" {...soft} />
      <circle cx="10" cy="10" r="3.1" />
      <path d="M10 2.6v1.8M10 15.6v1.8M2.6 10h1.8M15.6 10h1.8M4.8 4.8l1.2 1.2M14 14l1.2 1.2M4.8 15.2 6 14M14 6l1.2-1.2" />
    </>
  ),
  // Inbox: a tray with a letter dropping in.
  inbox: (
    <>
      <path
        d="M3 12h3.6l1.2 2h4.4l1.2-2H17v3a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 15Z"
        {...soft}
      />
      <path d="M3 12v3a1.6 1.6 0 0 0 1.6 1.6h10.8A1.6 1.6 0 0 0 17 15v-3M3 12h3.6l1.2 2h4.4l1.2-2H17M3 12l1.8-5M17 12l-1.8-5" />
      <path d="M10 3.2v5.6M7.8 6.8 10 9l2.2-2.2" />
    </>
  ),
  // Upcoming: a calendar page with an arrow forward.
  upcoming: (
    <>
      <rect x="3.2" y="4.4" width="13.6" height="4" rx="1.4" {...soft} />
      <rect x="3.2" y="4.4" width="13.6" height="12.2" rx="2" />
      <path d="M3.2 8.4h13.6M7 2.8v3M13 2.8v3M7.6 12.6h4.6M10.6 10.8l1.8 1.8-1.8 1.8" />
    </>
  ),
  // Overdue: an hourglass whose sand has run down.
  overdue: (
    <>
      <path d="M6.4 16.2c.3-2.2 1.6-3 3.6-3s3.3.8 3.6 3Z" {...soft} />
      <path d="M5.6 3h8.8M5.6 17h8.8M6.4 3c0 3.4 3.6 4.4 3.6 7s-3.6 3.6-3.6 7M13.6 3c0 3.4-3.6 4.4-3.6 7s3.6 3.6 3.6 7" />
    </>
  ),
  // Completed: a ticked box.
  completed: (
    <>
      <rect x="3.4" y="3.4" width="13.2" height="13.2" rx="3.6" {...soft} />
      <rect x="3.4" y="3.4" width="13.2" height="13.2" rx="3.6" />
      <path d="m6.8 10.2 2.2 2.2 4.4-4.6" />
    </>
  ),
};

export function SmartListIcon({ list }: { list: SmartList }) {
  return (
    <svg
      className="size-[22px] shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[list]}
    </svg>
  );
}
