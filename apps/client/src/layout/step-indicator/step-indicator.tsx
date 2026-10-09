import type { ReactElement } from "react";

import type { IconName } from "../../components/icon/icon";
import { Icon } from "../../components/icon/icon";
import { texts } from "../../i18n/texts";

import styles from "./step-indicator.module.css";

const STEPS: readonly { readonly label: string; readonly icon: IconName }[] = [
  { label: texts.shell.steps.cart, icon: "bag" },
  { label: texts.shell.steps.address, icon: "map-pin" },
  { label: texts.shell.steps.contact, icon: "user" },
  { label: texts.shell.steps.send, icon: "send" },
  { label: texts.shell.steps.tracking, icon: "check" },
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
        {STEPS.map(({ label, icon }, index) => (
          <li
            key={label}
            className={index === 0 ? styles.current : styles.upcoming}
            aria-current={index === 0 ? "step" : undefined}
          >
            <span className={styles.dot} aria-hidden="true">
              <Icon name={icon} />
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
