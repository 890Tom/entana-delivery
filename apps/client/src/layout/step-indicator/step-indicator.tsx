import type { ReactElement } from "react";

import type { IconName } from "../../components/icon/icon";
import { Icon } from "../../components/icon/icon";
import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
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
 * The full indicator, with the first step current: it is only shown on the catalogue and the cart.
 * On a narrow screen only the cart shows it (the catalogue does not, by the design).
 * The current step becomes a prop, and done steps a state, when the next screens use it.
 * The following steps are plain text, never links: they are reached by the order flow only.
 */
export function StepIndicator({
  isShownOnMobile = false,
}: {
  isShownOnMobile?: boolean;
}): ReactElement {
  return (
    <nav
      className={[styles.nav, isShownOnMobile ? styles.onMobile : ""].join(" ")}
      aria-label={texts.shell.steps.label}
    >
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
            <span
              className={
                index === 0 ? undefined : [styles.label, visuallyHidden.visuallyHidden].join(" ")
              }
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
