import { AppShell } from './components/AppShell';
import { TEXTS } from './constants/texts';
import { useAppLocation } from './features/navigation/useAppLocation';
import { viewTitle } from './features/navigation/viewTitle';

export function App() {
  const [location] = useAppLocation();

  return (
    <AppShell
      sidebar={
        <div className="px-4 py-4">
          <span className="text-sm font-semibold">{TEXTS.appTitle}</span>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{viewTitle(location.view)}</h1>
      </div>
    </AppShell>
  );
}
