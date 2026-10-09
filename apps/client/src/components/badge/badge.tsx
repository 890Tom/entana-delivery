import type { ReactElement, ReactNode } from "react";

import styles from "./badge.module.css";

/** The inverse badge of the design system, the only tone the catalogue needs. */
export function Badge({ children }: { children: ReactNode }): ReactElement {
  return <span className={styles.badge}>{children}</span>;
}
