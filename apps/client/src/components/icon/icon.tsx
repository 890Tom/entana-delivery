import type { ReactElement } from "react";

import styles from "./icon.module.css";

export type IconName = "plus" | "minus" | "trash" | "bag";

// Inline line icons (no request, no package). Decorative: the control that holds one is named.
const ICON_PATHS: Readonly<Record<IconName, readonly string[]>> = {
  plus: ["M5 12h14", "M12 5v14"],
  minus: ["M5 12h14"],
  trash: [
    "M3 6h18",
    "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",
    "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",
    "M10 11v6",
    "M14 11v6",
  ],
  bag: ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
};

export function Icon({ name }: { name: IconName }): ReactElement {
  return (
    <svg
      className={styles.icon}
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
