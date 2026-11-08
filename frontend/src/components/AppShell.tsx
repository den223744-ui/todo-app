import type { ReactNode } from 'react';

import { TEXTS } from '../constants/texts';
import { useUiStore } from '../store/uiStore';
import { BrandLogo } from './BrandLogo';
import { IconButton } from './IconButton';
import { MobileDrawer } from './MobileDrawer';
import { MenuIcon } from './icons/MenuIcon';

interface AppShellProps {
  sidebar: ReactNode;
  /** The task detail panel, when a task is open. */
  details?: ReactNode;
  children: ReactNode;
}

/**
 * Page layout: sidebar | main list | detail panel.
 * Below the md breakpoint the sidebar becomes a drawer behind a menu button.
 */
export function AppShell({ sidebar, details, children }: AppShellProps) {
  const drawerOpen = useUiStore((state) => state.drawerOpen);
  const openDrawer = useUiStore((state) => state.openDrawer);
  const closeDrawer = useUiStore((state) => state.closeDrawer);

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        aria-label={TEXTS.navigation}
        className="hidden w-64 shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-line bg-sidebar [scrollbar-width:thin] md:flex"
      >
        {sidebar}
      </aside>
      {drawerOpen && <MobileDrawer onClose={closeDrawer}>{sidebar}</MobileDrawer>}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-sidebar px-2 py-2 md:hidden">
          <IconButton label={TEXTS.openMenu} aria-expanded={drawerOpen} onClick={openDrawer}>
            <MenuIcon />
          </IconButton>
          <BrandLogo className="text-lg font-bold tracking-[0.04em]" />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      {details}
    </div>
  );
}
