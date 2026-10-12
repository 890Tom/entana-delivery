import type { ReactElement } from "react";

export type OrderIconName =
  "arrow-right" | "bell" | "calendar" | "check" | "chevron-down" | "search" | "truck";

// Inline line icons (no request, no package). Decorative: the text beside them says the same.
const ICON_PATHS: Readonly<Record<OrderIconName, readonly string[]>> = {
  "arrow-right": ["M5 12h14", "m12 5 7 7-7 7"],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  calendar: [
    "M8 2v4",
    "M16 2v4",
    "M3 10h18",
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  ],
  check: ["M20 6 9 17l-5-5"],
  "chevron-down": ["m6 9 6 6 6-6"],
  search: ["M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "m21 21-4.3-4.3"],
  truck: [
    "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",
    "M15 18H9",
    "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14",
    "M7 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
    "M17 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  ],
};

export function OrderIcon({ name, size }: { name: OrderIconName; size: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
