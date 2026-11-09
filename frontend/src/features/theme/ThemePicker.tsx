import { SunIcon } from '../../components/icons/SunIcon';
import { MoonIcon } from '../../components/icons/MoonIcon';
import { MonitorIcon } from '../../components/icons/MonitorIcon';
import { D_TEXTS } from '../../constants/texts';
import { THEMES } from '../../domain/theme';
import { useThemeStore } from '../../store/themeStore';

const icons = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };

export function ThemePicker() {
  const { theme, setTheme } = useThemeStore();
  return (
    <div
      role="radiogroup"
      aria-label={D_TEXTS.theme}
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
            aria-label={D_TEXTS.themes[value]}
            title={D_TEXTS.themes[value]}
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
            className={`flex size-11 items-center justify-center rounded-md border ${value === theme ? 'border-check text-check' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
