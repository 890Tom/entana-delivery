import type { ReactElement, Ref } from "react";

import { OrderIcon } from "../../orders/components/order-icons";
import type { OrderIconName } from "../../orders/components/order-icons";

import styles from "./detail-button.module.css";

type Variant = "primary" | "secondary" | "dangerOutline" | "danger";

interface DetailButtonProps {
  readonly label: string;
  readonly variant: Variant;
  readonly icon?: OrderIconName;
  readonly isDisabled?: boolean;
  readonly isBusy?: boolean;
  readonly onClick: () => void;
  /** The button, so that the screen can give the focus back to it. */
  readonly ref?: Ref<HTMLButtonElement>;
}

/**
 * A button of the order sheet. Disabled, it stays focusable (`aria-disabled`) and never clicks:
 * the focus is not lost when an action starts.
 */
export function DetailButton({
  label,
  variant,
  icon,
  isDisabled = false,
  isBusy = false,
  onClick,
  ref,
}: DetailButtonProps): ReactElement {
  return (
    <button
      ref={ref}
      type="button"
      className={[styles.button, styles[variant]].join(" ")}
      aria-disabled={isDisabled ? true : undefined}
      aria-busy={isBusy ? true : undefined}
      onClick={isDisabled ? undefined : onClick}
    >
      {icon !== undefined && <OrderIcon name={icon} size={20} />}
      {label}
    </button>
  );
}
