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

/** The phone layout of the delivery screen: the current step, its position and one segment each. */
function CompactSummary({ current }: { current: number }): ReactElement {
  const step = STEPS[current];
  return (
    <div className={styles.compact}>
      <div className={styles.compactHead}>
        <span className={styles.compactDot} aria-hidden="true">
          <Icon name={step?.icon ?? "bag"} />
        </span>
        <span className={styles.compactName}>{step?.label}</span>
        <span className={styles.compactPosition}>
          {texts.shell.steps.position(current + 1, STEPS.length)}
        </span>
      </div>
      <div className={styles.segments} aria-hidden="true">
        {STEPS.map(({ label }, index) => (
          <span key={label} className={styles[`segment-${stateOf(index, current)}`]} />
        ))}
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  /** The index of the current step; the steps before it are done. */
  readonly current?: number;
  /** On a narrow screen the catalogue shows none, the cart and the delivery screen show it. */
  readonly isShownOnMobile?: boolean;
  /** "compact" on a phone: the current step with its position, not the five steps. */
  readonly mobileLayout?: "full" | "compact";
}

/**
 * The five steps of the order. The following steps are plain text, never links, and so are the
 * done ones: the way back is the back button of the header.
 */
export function StepIndicator({
  current = 0,
  isShownOnMobile = false,
  mobileLayout = "full",
}: StepIndicatorProps): ReactElement {
  const isCompact = mobileLayout === "compact";
  const classNames = [
    styles.nav,
    isShownOnMobile ? styles.onMobile : "",
    isCompact ? styles.compactOnMobile : "",
  ].join(" ");
  return (
    <nav className={classNames} aria-label={texts.shell.steps.label}>
      <ol className={styles.list}>
        {STEPS.map((step, index) => (
          <Step key={step.label} index={index} current={current} step={step} />
        ))}
      </ol>
      {isCompact && <CompactSummary current={current} />}
    </nav>
  );
}
