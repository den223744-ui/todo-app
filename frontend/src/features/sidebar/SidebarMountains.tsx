import { useId } from 'react';

/** Decorative dusk mountains at the foot of the sidebar (as in the mockup). */
export function SidebarMountains() {
  // The sidebar also renders in the mobile drawer: gradient ids must not clash.
  const id = useId();
  const sky = `${id}-sky`;
  const far = `${id}-far`;
  const near = `${id}-near`;
  return (
    <svg
      className="pointer-events-none mt-auto block h-28 w-full shrink-0"
      viewBox="0 0 256 160"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sidebar)" />
          <stop offset="0.55" stopColor="#fbd9bf" stopOpacity="0.85" />
          <stop offset="1" stopColor="#f6b98f" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={far} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9b8b6" />
          <stop offset="1" stopColor="#e8c3a8" />
        </linearGradient>
        <linearGradient id={near} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8e8a93" />
          <stop offset="1" stopColor="#b9a7a4" />
        </linearGradient>
      </defs>
      <rect width="256" height="160" fill={`url(#${sky})`} />
      <path
        d="M0 104 34 78 58 92 96 58 128 86 160 70 200 96 232 80 256 92V160H0Z"
        fill={`url(#${far})`}
        opacity="0.8"
      />
      <path
        d="M0 122 22 100 44 112 76 84 104 106 120 98 152 124 186 104 214 118 256 104V160H0Z"
        fill={`url(#${near})`}
      />
      <path d="M76 84 86 96 80 95 74 104 70 92Z" fill="#f2e4dc" opacity="0.6" />
      <path d="M0 140 48 130 104 142 160 132 214 144 256 136V160H0Z" fill="#7f7b86" />
    </svg>
  );
}
