import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/** Keep two native rows at minimum; grow and shrink with text and panel width. */
export function AutosizeTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      element.style.height = 'auto';
      element.style.height = `${String(element.scrollHeight + element.offsetHeight - element.clientHeight)}px`;
    };
    resize();
    let width = element.getBoundingClientRect().width;
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            const nextWidth = element.getBoundingClientRect().width;
            if (nextWidth !== width) {
              width = nextWidth;
              resize();
            }
          })
        : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [props.value]);
  return <textarea {...props} ref={ref} rows={2} />;
}
