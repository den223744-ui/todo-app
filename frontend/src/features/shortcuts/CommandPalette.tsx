import { AnimatePresence } from 'framer-motion';
import { Command } from 'cmdk';
import { NavigationCommands } from './NavigationCommands';
import { TaskCommands } from './TaskCommands';
import { useEffect, useState } from 'react';
import { ShortcutDialog } from '../../components/ShortcutDialog';
import { D_TEXTS } from '../../constants/texts';
import { searchTopLevelTasks } from '../../domain/search';
import { THEMES } from '../../domain/theme';
import type { View } from '../../domain/view';
import { useThemeStore } from '../../store/themeStore';
import { useUiStore } from '../../store/uiStore';
import { useLists } from '../lists/useLists';
import { useAppLocation } from '../navigation/useAppLocation';
import { useTasks } from '../tasks/useTasks';
import { OPTIMISTIC_ID_PREFIX } from '../tasks/taskMutations';
import { focusQuickAdd, focusSearch } from './focus';

export function CommandPalette() {
  const open = useUiStore((state) => state.paletteOpen);
  const selected = useUiStore((state) => state.selectedTaskId);
  const { theme, setTheme } = useThemeStore();
  const { data: tasks = [] } = useTasks();
  const { data: lists = [] } = useLists();
  const [location, navigate] = useAppLocation();
  const [input, setInput] = useState('');
  useEffect(() => {
    if (!open) setInput('');
  }, [open]);
  const task = tasks.find((task) => task.id === (selected ?? location.taskId));
  const close = () => {
    useUiStore.getState().setPaletteOpen(false);
    setInput('');
  };
  const run = (action: () => void) => {
    close();
    requestAnimationFrame(action);
  };
  const go = (view: View, day?: string) => {
    run(() => {
      useUiStore.getState().setDayView('list');
      navigate({ view, query: '', taskId: null, day: day ?? null });
      requestAnimationFrame(() =>
        [...document.querySelectorAll<HTMLElement>('[data-view-heading]')]
          .find((heading) => !heading.closest('[aria-hidden="true"]'))
          ?.focus(),
      );
    });
  };
  return (
    <AnimatePresence>
      {open && (
        <ShortcutDialog key="dialog" title={D_TEXTS.palette} onClose={close}>
          <Command label={D_TEXTS.commandPlaceholder}>
            <Command.Input
              value={input}
              onValueChange={setInput}
              placeholder={D_TEXTS.commandPlaceholder}
              aria-label={D_TEXTS.commandPlaceholder}
              className="min-h-12 w-full border-b border-line bg-transparent px-4 outline-none"
            />
            <Command.List
              aria-label={D_TEXTS.commands}
              className="command-list max-h-[60dvh] overflow-y-auto p-2"
            >
              <Command.Empty className="p-4 text-sm text-ink-muted">
                {D_TEXTS.noCommands}
              </Command.Empty>
              <Command.Group heading={D_TEXTS.actions}>
                <Command.Item
                  value={D_TEXTS.newTask}
                  onSelect={() => {
                    run(focusQuickAdd);
                  }}
                >
                  {D_TEXTS.newTask}
                </Command.Item>
                <Command.Item
                  value={D_TEXTS.search}
                  onSelect={() => {
                    run(focusSearch);
                  }}
                >
                  {D_TEXTS.search}
                </Command.Item>
                <Command.Item
                  value={D_TEXTS.help}
                  onSelect={() => {
                    run(() => {
                      useUiStore.getState().setHelpOpen(true);
                    });
                  }}
                >
                  {D_TEXTS.help}
                </Command.Item>
              </Command.Group>
              <NavigationCommands tasks={tasks} lists={lists} onGo={go} />
              {task && !task.id.startsWith(OPTIMISTIC_ID_PREFIX) && (
                <TaskCommands task={task} run={run} />
              )}
              <Command.Group heading={D_TEXTS.theme}>
                {THEMES.map((value) => (
                  <Command.Item
                    key={value}
                    value={`theme-${value}`}
                    aria-current={theme === value ? 'true' : undefined}
                    keywords={[D_TEXTS.themes[value]]}
                    onSelect={() => {
                      run(() => {
                        setTheme(value);
                      });
                    }}
                  >
                    <span>{D_TEXTS.themes[value]}</span>
                    <span aria-hidden="true" className="ml-auto">
                      {theme === value ? '✓' : ''}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
              {input.trim() && (
                <Command.Group heading={D_TEXTS.tasks}>
                  {searchTopLevelTasks(tasks, input)
                    .filter((task) => !task.id.startsWith(OPTIMISTIC_ID_PREFIX))
                    .map((task) => (
                      <Command.Item
                        key={task.id}
                        value={`task-result-${task.id}`}
                        keywords={[task.title]}
                        onSelect={() => {
                          run(() => {
                            navigate({ taskId: task.id });
                          });
                        }}
                      >
                        {task.title}
                      </Command.Item>
                    ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </ShortcutDialog>
      )}
    </AnimatePresence>
  );
}
