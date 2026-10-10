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
  { label: texts.shell.steps.tracking, icon: "truck" },
];

type StepState = "done" | "current" | "upcoming";

function stateOf(index: number, current: number): StepState {
  if (index < current) {
    return "done";
  }
  return index === current ? "current" : "upcoming";
}

function Step({
  index,
  current,
  step,
}: {
  index: number;
  current: number;
  step: (typeof STEPS)[number];
}): ReactElement {
  const state = stateOf(index, current);
  return (
    <li className={styles[state]} aria-current={state === "current" ? "step" : undefined}>
      {/* The line that joins the step to the one before it: ink once the step is reached. */}
      {index > 0 && <span className={styles.joiner} aria-hidden="true" />}
      <span className={styles.step}>
        <span className={styles.dot} aria-hidden="true">
          <Icon name={state === "done" ? "check" : step.icon} />
        </span>
        <span
          className={
            state === "current"
              ? undefined
              : [styles.label, visuallyHidden.visuallyHidden].join(" ")
          }
        >
          {step.label}
        </span>
        {state === "done" && (
          <span className={visuallyHidden.visuallyHidden}>{texts.shell.steps.done}</span>
        )}
      </span>
    </li>
  );
}

interface StepIndicatorProps {
  /** The index of the current step; the steps before it are done. */
  readonly current?: number;
}

/**
 * The five steps of the order, the same on every screen, with the position in words above them.
 * The following steps are plain text, never links, and so are the done ones: the way back is the
 * back button of the header. On a narrow screen only the current step shows its name.
 */
export function StepIndicator({ current = 0 }: StepIndicatorProps): ReactElement {
  return (
    <nav className={styles.nav} aria-label={texts.shell.steps.label}>
      <div className={styles.inner}>
        <p className={styles.position}>{texts.shell.steps.position(current + 1, STEPS.length)}</p>
        <ol className={styles.list}>
          {STEPS.map((step, index) => (
            <Step key={step.label} index={index} current={current} step={step} />
          ))}
        </ol>
      </div>
    </nav>
  );
}
