import type { ReactElement, Ref } from "react";

import styles from "./button.module.css";

interface ButtonProps {
  readonly children: string;
  readonly isDisabled?: boolean;
  /** True while the action is being sent: announced, and the label stays the same. */
  readonly isBusy?: boolean;
  /** A form button submits the form; the click handler is then not needed. */
  readonly type?: "button" | "submit";
  readonly onClick?: () => void;
  readonly ref?: Ref<HTMLButtonElement>;
}

/**
 * The full-width ink button of the design system (the only variant the administration needs). A disabled one stays focusable (`aria-disabled`,
 * not `disabled`): the focus is not lost when it becomes disabled, and it is announced as
 * unavailable. A disabled button never submits nor clicks.
 */
export function Button({
  children,
  isDisabled = false,
  isBusy = false,
  type = "button",
  onClick,
  ref,
}: ButtonProps): ReactElement {
  return (
    <button
      ref={ref}
      type={type}
      className={styles.button}
      aria-disabled={isDisabled ? true : undefined}
      aria-busy={isBusy ? true : undefined}
      onClick={(event) => {
        if (isDisabled) {
          event.preventDefault();
          return;
        }
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}
