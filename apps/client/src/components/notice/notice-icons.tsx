import type { ReactElement } from "react";

import styles from "./notice.module.css";

type IconName = "circle-alert" | "info";

// Inline line icons (no request, no package). Decorative: the message beside them says the same.
const ICON_PATHS: Readonly<Record<IconName, readonly string[]>> = {
  "circle-alert": ["M12 8v4", "M12 16h.01"],
  info: ["M12 16v-4", "M12 8h.01"],
};

export function NoticeIcon({ name }: { name: IconName }): ReactElement {
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
      <circle cx="12" cy="12" r="10" />
      {ICON_PATHS[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
