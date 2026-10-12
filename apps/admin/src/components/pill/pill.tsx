import type { ReactElement, ReactNode } from "react";

import styles from "./pill.module.css";

interface PillProps {
  /** "highlight": a state to notice (gold). "neutral": a state that is over (grey). */
  readonly tone: "highlight" | "neutral";
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}

/** A short state, told by its text and its icon: the colour never says it alone. */
export function Pill({ tone, icon, children }: PillProps): ReactElement {
  return (
    <span className={[styles.pill, styles[tone]].join(" ")}>
      {icon}
      {children}
    </span>
  );
}
