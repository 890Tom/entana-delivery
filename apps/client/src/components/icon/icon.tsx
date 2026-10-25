import type { ReactElement } from "react";

import styles from "./icon.module.css";

export type IconName =
  | "arrow-left"
  | "plus"
  | "minus"
  | "trash"
  | "bag"
  | "map-pin"
  | "user"
  | "send"
  | "check"
  | "house"
  | "locate-fixed"
  | "crosshair"
  | "truck"
  | "phone"
  | "calendar"
  | "inbox"
  | "calendar-check"
  | "search"
  | "store"
  | "navigation"
  | "chevron-right"
  | "x";

// Inline line icons (no request, no package). Decorative: the control that holds one is named.
// Exported for the map marker, which is drawn outside React by the map library.
export const ICON_PATHS: Readonly<Record<IconName, readonly string[]>> = {
  "arrow-left": ["m12 19-7-7 7-7", "M19 12H5"],
  plus: ["M5 12h14", "M12 5v14"],
  minus: ["M5 12h14"],
  trash: [
    "M3 6h18",
    "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",
    "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",
    "M10 11v6",
    "M14 11v6",
  ],
  "map-pin": [
    "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z",
    "M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  ],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  check: ["M20 6 9 17l-5-5"],
  bag: ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
  house: ["M3 11 12 3l9 8", "M5 9.5V21h14V9.5", "M10 21v-6h4v6"],
  "locate-fixed": [
    "M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z",
    "M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
    "M12 2v3",
    "M12 19v3",
    "M2 12h3",
    "M19 12h3",
  ],
  crosshair: ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z", "M12 1v7", "M12 16v7", "M1 12h7", "M16 12h7"],
  truck: [
    "M2 6h12v10H2Z",
    "M14 9h4l4 4v3h-8Z",
    "M7 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
    "M18 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  ],
  phone: [
    "M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z",
  ],
  calendar: [
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    "M16 2v4",
    "M8 2v4",
    "M3 10h18",
  ],
  inbox: ["M22 12h-6l-2 3h-4l-2-3H2", "M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"],
  "calendar-check": [
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    "M16 2v4",
    "M8 2v4",
    "M3 10h18",
    "m9 16 2 2 4-4",
  ],
  // The magnifying glass of the same line set: the way to find an order again.
  search: ["M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z", "m21 21-4.35-4.35"],
  // The cross of the same line set: the way to empty a field.
  x: ["M18 6 6 18", "m6 6 12 12"],
  // The shop: awning, then the body with its door. The marker of a reseller and its tile.
  store: [
    "m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7",
    "M2 7h20v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z",
    "M4 11v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9",
    "M10 22v-5h4v5",
  ],
  // The arrow of a route.
  navigation: ["M3 11 22 2l-9 19-2-8Z"],
  "chevron-right": ["m9 18 6-6-6-6"],
};

/** "small" is the size of an icon inside a step dot. */
export function Icon({ name, size }: { name: IconName; size?: "small" }): ReactElement {
  return (
    <svg
      className={size === "small" ? [styles.icon, styles.small].join(" ") : styles.icon}
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
