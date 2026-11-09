import { ShortcutDialog } from '../../components/ShortcutDialog';
import { D_TEXTS } from '../../constants/texts';
import { isMacPlatform } from '../../domain/shortcuts';
import { useUiStore } from '../../store/uiStore';

export function ShortcutHelp() {
  const open = useUiStore((state) => state.helpOpen);
  const close = () => {
    useUiStore.getState().setHelpOpen(false);
  };
  const mod = isMacPlatform(navigator.userAgent) ? '⌘' : 'Ctrl';
  if (!open) return null;
  return (
    <ShortcutDialog title={D_TEXTS.help} onClose={close}>
      <div className="max-h-[70dvh] overflow-y-auto px-4 pb-4">
        {D_TEXTS.shortcutGroups.map((group) => (
          <table key={group.title} className="w-full text-sm">
            <caption className="pt-4 pb-2 text-left font-display text-lg font-bold">
              {group.title}
            </caption>
            <thead className="sr-only">
              <tr>
                <th>{D_TEXTS.keyColumn}</th>
                <th>{D_TEXTS.actionColumn}</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map(([key, action]) => (
                <tr key={key}>
                  <td className="py-1.5 pr-4">
                    <kbd className="inline-block rounded-md border border-line px-1.5 py-0.5 text-xs whitespace-nowrap">
                      {key.replace('Mod', mod)}
                    </kbd>
                  </td>
                  <td className="py-1.5 text-ink-muted">{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </ShortcutDialog>
  );
}
