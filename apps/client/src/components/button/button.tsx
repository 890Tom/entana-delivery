import type { ReactElement, Ref } from "react";

import { Icon } from "../icon/icon";
import type { IconName } from "../icon/icon";

import styles from "./button.module.css";

interface ButtonProps {
  readonly children: string;
  /** Names the button for assistive technology when the visible label is not enough. */
  readonly label?: string;
  readonly icon?: IconName;
  /** "accent" is the soft gold of the owner's design for "Utiliser ma position". */
  readonly variant?: "secondary" | "accent";
  readonly isDisabled?: boolean;
  readonly onClick: () => void;
  readonly ref?: Ref<HTMLButtonElement>;
}

/**
 * The full-width button of the design system, secondary or the soft accent. A disabled
 * one stays focusable (`aria-disabled`, not `disabled`): the focus is not lost when it becomes
 * disabled, and it is announced as unavailable.
 */
export function Button({
  children,
  label,
  icon,
  variant = "secondary",
  isDisabled = false,
  onClick,
  ref,
}: ButtonProps): ReactElement {
  return (
    <button
      ref={ref}
      type="button"
      className={[styles.button, variant === "accent" ? styles.accent : ""].join(" ")}
      aria-label={label}
      aria-disabled={isDisabled ? true : undefined}
      onClick={isDisabled ? undefined : onClick}
    >
      {icon !== undefined && <Icon name={icon} />}
      {children}
    </button>
  );
}
