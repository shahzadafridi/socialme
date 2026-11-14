import type { JSX } from 'react';

const PATHS: Record<string, JSX.Element> = {
  spark: (
    <path d="M8 1.5l1.35 4.15L13.5 7l-4.15 1.35L8 12.5 6.65 8.35 2.5 7l4.15-1.35L8 1.5z" />
  ),
  gear: (
    <>
      <path d="M2.5 5h11M2.5 11h11" />
      <circle cx="6" cy="5" r="1.7" />
      <circle cx="10.5" cy="11" r="1.7" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.6" />
      <path d="M10.5 5.5V4.2A1.2 1.2 0 009.3 3H4.2A1.2 1.2 0 003 4.2v5.1a1.2 1.2 0 001.2 1.2h1.3" />
    </>
  ),
  send: <path d="M2.5 8l11-5.5-4 11-2.2-4.3L2.5 8z" />,
  refresh: (
    <>
      <path d="M13.2 8a5.2 5.2 0 11-1.6-3.7" />
      <path d="M13.4 2.2v2.9h-2.9" />
    </>
  ),
  check: <path d="M3 8.4l3.2 3.2L13 4.6" />,
  chevron: <path d="M4 6.5L8 10l4-3.5" />,
  trash: (
    <>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8.2A1 1 0 006.6 13.6h2.8a1 1 0 001-.9l.6-8.2" />
    </>
  ),
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  external: (
    <>
      <path d="M9 3.5h3.5V7" />
      <path d="M12.5 3.5L7.5 8.5" />
      <path d="M11 10.5v1.3a1.2 1.2 0 01-1.2 1.2H4.2A1.2 1.2 0 013 11.8V6.2A1.2 1.2 0 014.2 5h1.3" />
    </>
  ),
  stop: <rect x="4.5" y="4.5" width="7" height="7" rx="1.4" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 4.6V8l2.4 1.5" />
    </>
  ),
  warning: (
    <>
      <path d="M8 2.6l5.4 9.6H2.6L8 2.6z" />
      <path d="M8 6.6v2.2M8 10.7v.1" />
    </>
  ),
};

export function Icon({
  name,
  size = 15,
  strokeWidth = 1.6,
  fill = 'none',
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
}) {
  const children = PATHS[name] ?? null;
  const isFilled = name === 'spark' || name === 'send';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={isFilled ? 'currentColor' : fill}
      stroke={isFilled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none', display: 'block' }}
    >
      {children}
    </svg>
  );
}
