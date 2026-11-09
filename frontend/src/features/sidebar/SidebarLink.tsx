import type { MouseEvent, ReactNode } from 'react';

import { LIST_TITLES } from '../../constants/texts';

interface SidebarLinkProps {
  href: string;
  active: boolean;
  onNavigate: () => void;
  icon: ReactNode;
  label: string;
  count?: number | undefined;
  /** Highlight the count, e.g. overdue tasks. */
  urgent?: boolean;
}

/**
 * A real link (new tab and copy-link work); a plain click navigates in place.
 */
export function SidebarLink({
  href,
  active,
  onNavigate,
  icon,
  label,
  count,
  urgent = false,
}: SidebarLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (modified || event.button !== 0) return; // let the browser open a new tab/window
    event.preventDefault();
    onNavigate();
  };

  return (
    <a
      data-sidebar-today={label === LIST_TITLES.today || undefined}
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[15px] ${
        active ? 'nav-glow font-medium text-ink' : 'nav-glow-hover text-ink-muted hover:text-ink'
      }`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`min-w-6 rounded-md px-1 text-center text-sm tabular-nums ${
            urgent ? 'font-medium text-danger' : 'text-ink-faint'
          } ${active ? 'bg-surface shadow-soft' : ''}`}
        >
          {count}
        </span>
      )}
    </a>
  );
}
