import type { ReactElement } from "react";

import { Icon } from "../../../components/icon/icon";
import type { IconName } from "../../../components/icon/icon";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import type { StepKey, StepView } from "../rules/describe-tracking-status";

import styles from "./order-timeline.module.css";

const STEP_ICONS: Readonly<Record<StepKey, IconName>> = {
  received: "inbox",
  confirmed: "calendar-check",
  outForDelivery: "truck",
  delivered: "house",
};

function Step({ step, isLast }: { step: StepView; isLast: boolean }): ReactElement {
  const { steps, stepStates } = texts.tracking;
  return (
    <li
      className={[styles.step, styles[step.state]].join(" ")}
      aria-current={step.state === "current" ? "step" : undefined}
    >
      <div className={styles.rail}>
        <span className={styles.dot} aria-hidden="true">
          <Icon name={step.state === "done" ? "check" : STEP_ICONS[step.key]} size="small" />
        </span>
        {!isLast && <span className={styles.joiner} aria-hidden="true" />}
      </div>
      <div className={styles.text}>
        <span className={styles.label}>
          {steps[step.key]}
          {/* Colour and icon are not enough: the state is also said in words. */}
          <span className={visuallyHidden.visuallyHidden}> {stepStates[step.state]}</span>
        </span>
        {step.detail !== null && <span className={styles.detail}>{step.detail}</span>}
      </div>
    </li>
  );
}

/** The steps of the delivery, one under the other, with the one the order is at. */
export function OrderTimeline({ steps }: { steps: readonly StepView[] }): ReactElement {
  return (
    <ol className={styles.list} aria-label={texts.tracking.stepsLabel}>
      {steps.map((step, index) => (
        <Step key={step.key} step={step} isLast={index === steps.length - 1} />
      ))}
    </ol>
  );
}
