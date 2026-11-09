import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name: the button shows only an icon. */
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
