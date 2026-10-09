import type { ReactElement } from "react";

import { texts } from "../../i18n/texts";

import styles from "./step-indicator.module.css";

const STEPS = [
  texts.shell.steps.cart,
  texts.shell.steps.address,
  texts.shell.steps.contact,
  texts.shell.steps.send,
  texts.shell.steps.tracking,
];

/**
 * The full (web) indicator, with the first step current: it is only shown on the catalogue.
 * The current step becomes a prop, and done steps a state, when the next screens use it.
 * The following steps are plain text, never links: they are reached by the order flow only.
 */
export function StepIndicator(): ReactElement {
  return (
    <nav className={styles.nav} aria-label={texts.shell.steps.label}>
      <ol className={styles.list}>
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={index === 0 ? styles.current : styles.upcoming}
            aria-current={index === 0 ? "step" : undefined}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
