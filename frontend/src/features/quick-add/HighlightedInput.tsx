import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

import { TEXTS } from '../../constants/texts';
import type { QuickAddToken } from '../../domain/quickAdd';
import { quickAddSegments } from '../../domain/quickAddInput';

interface HighlightedInputProps {
  id: string;
  value: string;
  tokens: readonly QuickAddToken[];
  inputRef: RefObject<HTMLInputElement>;
  invalid: boolean;
  describedBy: string;
  onChange: (value: string) => void;
  onCompositionChange: (composing: boolean) => void;
}

/** A native input keeps selection, caret, paste and screen-reader behavior. */
export function HighlightedInput({
  id,
  value,
  tokens,
  inputRef,
  invalid,
  describedBy,
  onChange,
  onCompositionChange,
}: HighlightedInputProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const syncScroll = useCallback(() => {
    if (mirrorRef.current && inputRef.current)
      mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
  }, [inputRef]);
  useLayoutEffect(syncScroll, [value, tokens, syncScroll]);
  useEffect(() => {
    // Font loading and viewport changes can shift the native input's scroll.
    window.addEventListener('resize', syncScroll);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- jsdom does not implement FontFaceSet.
    document.fonts?.addEventListener('loadingdone', syncScroll);
    return () => {
      window.removeEventListener('resize', syncScroll);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- jsdom does not implement FontFaceSet.
      document.fonts?.removeEventListener('loadingdone', syncScroll);
    };
  }, [syncScroll]);

  return (
    <div className="quick-add-field relative min-w-0 flex-1 rounded-xl border border-line bg-surface shadow-soft focus-within:border-check">
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="quick-add-mirror pointer-events-none absolute inset-0 overflow-hidden px-3 py-3 text-base leading-6 whitespace-pre text-ink md:text-sm"
      >
        {quickAddSegments(value, tokens).map((segment, index) =>
          segment.kind ? (
            <mark
              key={index}
              data-token-kind={segment.kind}
              className="rounded-sm bg-accent-soft text-accent-ink underline decoration-accent-ink/40 underline-offset-4"
            >
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </div>
      <input
        ref={inputRef}
        id={id}
        data-quick-add-input
        type="text"
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={TEXTS.quickAddPlaceholder}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        className="quick-add-native relative block w-full min-w-0 rounded-lg bg-transparent px-3 py-3 text-base leading-6 text-transparent caret-ink placeholder:text-ink-faint selection:bg-accent-soft selection:text-ink md:text-sm"
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
        onScroll={syncScroll}
        onCompositionStart={() => {
          composingRef.current = true;
          onCompositionChange(true);
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          onCompositionChange(false);
        }}
        onKeyDown={(event) => {
          // Safari can report IME Enter after compositionend, with code 229.
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          const legacyIme = event.keyCode === 229;
          if (
            event.key === 'Enter' &&
            (composingRef.current || event.nativeEvent.isComposing || legacyIme)
          )
            event.preventDefault();
        }}
      />
    </div>
  );
}
