import type { ReactElement } from "react";

import styles from "./switch.module.css";

interface SwitchProps {
  /** The accessible name: the control has no visible text of its own. */
  readonly label: string;
  readonly isOn: boolean;
  readonly isDisabled?: boolean;
  readonly onToggle: () => void;
}

/**
 * An on/off control. Disabled, it stays focusable (`aria-disabled`) and never toggles, so the
 * focus is not lost while a change is being sent.
 */
export function Switch({ label, isOn, isDisabled = false, onToggle }: SwitchProps): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
      aria-disabled={isDisabled ? true : undefined}
      className={styles.switch}
      onClick={isDisabled ? undefined : onToggle}
    >
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
    </button>
  );
}
