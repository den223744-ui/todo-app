import { SunIcon } from '../../components/icons/SunIcon';
import { MoonIcon } from '../../components/icons/MoonIcon';
import { MonitorIcon } from '../../components/icons/MonitorIcon';
import { THEME_TEXTS } from '../../constants/texts';
import { THEMES } from '../../domain/theme';
import { useThemeStore } from '../../store/themeStore';

const icons = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };

export function ThemePicker() {
  const { theme, setTheme } = useThemeStore();
  return (
    <div
      role="radiogroup"
      aria-label={THEME_TEXTS.theme}
      data-shortcut-arrows
      className="inline-flex rounded-lg border border-line p-0.5"
    >
      {THEMES.map((value, index) => {
        const Icon = icons[value];
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={value === theme}
            aria-label={THEME_TEXTS.themes[value]}
            tabIndex={value === theme ? 0 : -1}
            onClick={() => {
              setTheme(value);
            }}
            onKeyDown={(event) => {
              const delta =
                event.key === 'ArrowRight' || event.key === 'ArrowDown'
                  ? 1
                  : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                    ? -1
                    : 0;
              if (!delta && event.key !== 'Home' && event.key !== 'End') return;
              event.preventDefault();
              const next =
                event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + delta + 3) % 3;
              setTheme(THEMES[next] as (typeof THEMES)[number]);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('button')
                [next]?.focus();
            }}
            className={`group/theme relative flex size-11 items-center justify-center rounded-md border ${value === theme ? 'border-check text-check' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            <Icon />
            {/* Our own tooltip: at once on hover and on keyboard focus (the native
                title shows late and only for the mouse). The name is already in
                aria-label, so screen readers skip this copy. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink opacity-0 shadow-soft transition-opacity duration-150 group-hover/theme:opacity-100 group-focus-visible/theme:opacity-100 motion-reduce:transition-none"
            >
              {THEME_TEXTS.themes[value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
