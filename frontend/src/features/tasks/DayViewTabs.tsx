import { TEXTS, TIMELINE_TEXTS } from '../../constants/texts';
import { useUiStore } from '../../store/uiStore';

const VIEWS = ['list', 'timeline'] as const;

export function DayViewTabs() {
  const view = useUiStore((state) => state.dayView);
  const setView = useUiStore((state) => state.setDayView);
  return (
    <div
      role="tablist"
      aria-label={TEXTS.dayViews}
      className="mt-3 flex gap-1 border-b border-line md:mt-4"
    >
      {VIEWS.map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          id={`day-tab-${value}`}
          aria-controls={`day-panel-${value}`}
          aria-selected={view === value}
          tabIndex={view === value ? 0 : -1}
          onClick={() => {
            setView(value);
          }}
          onKeyDown={(event) => {
            let next: typeof view;
            if (event.key === 'Home') next = 'list';
            else if (event.key === 'End') next = 'timeline';
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
              next = view === 'list' ? 'timeline' : 'list';
            else return;
            event.preventDefault();
            setView(next);
            document.getElementById(`day-tab-${next}`)?.focus();
          }}
          className="min-h-11 rounded-t-lg border-b-2 border-transparent px-4 text-sm text-ink-muted aria-selected:border-check aria-selected:font-semibold aria-selected:text-ink"
        >
          {value === 'list' ? TEXTS.listTab : TIMELINE_TEXTS.tab}
        </button>
      ))}
    </div>
  );
}
