import type { ReactElement, ReactNode } from "react";

import buttonStyles from "../../../components/form-buttons/form-buttons.module.css";

import styles from "./place-drawing.module.css";

interface ToggleButtonProps {
  /** The name, the same on and off: the pressed state says the rest. */
  readonly label: string;
  /** What the button shows once on, when it says more than its name. */
  readonly onText?: string;
  readonly isOn: boolean;
  readonly icon?: ReactNode;
  /** Disabled, it stays focusable (`aria-disabled`) and does nothing. */
  readonly isDisabled?: boolean;
  readonly describedBy?: string;
  readonly onToggle: () => void;
}

/** A secondary button that stays pressed while its mode is on (to confirm: the accent look). */
export function ToggleButton({
  label,
  onText,
  isOn,
  icon,
  isDisabled = false,
  describedBy,
  onToggle,
}: ToggleButtonProps): ReactElement {
  const classes = [buttonStyles.action, buttonStyles.secondary, isOn ? styles.on : ""];
  return (
    <button
      type="button"
      className={classes.join(" ")}
      aria-label={label}
      aria-pressed={isOn}
      aria-disabled={isDisabled ? true : undefined}
      aria-describedby={describedBy}
      onClick={() => {
        if (!isDisabled) {
          onToggle();
        }
      }}
    >
      {icon}
      {isOn ? (onText ?? label) : label}
    </button>
  );
}
