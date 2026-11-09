interface DayStatProps {
  icon: string;
  value: number;
  label: string;
  mobileLabel?: string;
  tone?: string;
}

export function DayStat({
  icon,
  value,
  label,
  mobileLabel,
  tone = 'text-ink-muted',
}: DayStatProps) {
  return (
    <div className="flex min-w-0 items-center gap-3 md:@xl:flex-1 md:@xl:px-4">
      <svg
        className={`hidden size-7 shrink-0 md:block ${tone}`}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d={icon} />
      </svg>
      <div>
        <p className="text-xs font-semibold text-ink tabular-nums md:text-[15px]">{value}</p>
        <p
          className={`${mobileLabel ? 'hidden md:block' : ''} text-[10px] whitespace-nowrap text-ink-muted md:text-xs`}
        >
          {label}
        </p>
        {mobileLabel && (
          <p className="text-[10px] whitespace-nowrap text-ink-muted md:hidden">{mobileLabel}</p>
        )}
      </div>
    </div>
  );
}
