import { TEXTS } from './constants/texts';

export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-2 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">{TEXTS.appTitle}</h1>
      <p className="text-neutral-500">{TEXTS.appSubtitle}</p>
    </main>
  );
}
