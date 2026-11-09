import { AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

import { TEXTS } from '../constants/texts';
import { useUiStore } from '../store/uiStore';

import { BrandLogo } from './BrandLogo';
import { IconButton } from './IconButton';
import { MenuIcon } from './icons/MenuIcon';
import { MobileDrawer } from './MobileDrawer';

interface AppShellProps {
  sidebar: ReactNode;
  /** The task detail panel, when a task is open. */
  details?: ReactNode;
  children: ReactNode;
  mobileSearch?: ReactNode;
}

/**
 * Page layout: sidebar | main list | detail panel.
 * Below the md breakpoint the sidebar becomes a drawer behind a menu button.
 */
export function AppShell({ sidebar, details, children, mobileSearch }: AppShellProps) {
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
      <AnimatePresence initial={false}>
        {drawerOpen && (
          <MobileDrawer key="drawer" onClose={closeDrawer}>
            {sidebar}
          </MobileDrawer>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-2 border-b border-line bg-sidebar px-2 py-2 md:hidden">
          <IconButton label={TEXTS.openMenu} aria-expanded={drawerOpen} onClick={openDrawer}>
            <MenuIcon />
          </IconButton>
          {mobileSearch}
          <BrandLogo className="text-base" />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto [scroll-padding-bottom:calc(var(--quick-add-height,84px)+16px)] md:[scroll-padding-bottom:16px]">
          {children}
        </main>
      </div>

      {details}
    </div>
  );
}
