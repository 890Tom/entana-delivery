import type { ReactElement, Ref } from "react";

import { Icon } from "../icon/icon";
import type { IconName } from "../icon/icon";

import styles from "./button.module.css";

interface ButtonProps {
  readonly children: string;
  /** Names the button for assistive technology when the visible label is not enough. */
  readonly label?: string;
  readonly icon?: IconName;
  readonly isDisabled?: boolean;
  readonly onClick: () => void;
  readonly ref?: Ref<HTMLButtonElement>;
}

/**
 * The secondary, full-width button of the design system (the only variant used so far). A disabled
 * one stays focusable (`aria-disabled`, not `disabled`): the focus is not lost when it becomes
 * disabled, and it is announced as unavailable.
 */
export function Button({
  children,
  label,
  icon,
  isDisabled = false,
  onClick,
  ref,
}: ButtonProps): ReactElement {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.button}
      aria-label={label}
      aria-disabled={isDisabled ? true : undefined}
      onClick={isDisabled ? undefined : onClick}
    >
      {icon !== undefined && <Icon name={icon} />}
      {children}
    </button>
  );
}
