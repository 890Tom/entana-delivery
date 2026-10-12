import type { ReactElement } from "react";
import { Link } from "wouter";

import styles from "./action-button.module.css";
import { OrderIcon } from "./order-icons";
import type { OrderIconName } from "./order-icons";

type Variant = "primary" | "secondary" | "quiet";

interface Common {
  readonly label: string;
  /** The name read aloud when it says more than the visible text (the order code). */
  readonly accessibleName?: string;
  readonly variant: Variant;
  readonly icon?: OrderIconName;
}

const classOf = (variant: Variant): string => [styles.action, styles[variant]].join(" ");

/** A button of the orders screen. Disabled, it stays focusable (`aria-disabled`) and never clicks. */
export function ActionButton({
  label,
  accessibleName,
  variant,
  icon,
  isDisabled = false,
  isBusy = false,
  onClick,
}: Common & {
  readonly isDisabled?: boolean;
  readonly isBusy?: boolean;
  readonly onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={classOf(variant)}
      aria-label={accessibleName}
      aria-disabled={isDisabled ? true : undefined}
      aria-busy={isBusy ? true : undefined}
      onClick={isDisabled ? undefined : onClick}
    >
      {icon !== undefined && <OrderIcon name={icon} size={20} />}
      {label}
    </button>
  );
}

/** A link that looks like a button: it opens the sheet of an order. */
export function ActionLink({
  label,
  accessibleName,
  variant,
  icon,
  href,
}: Common & { readonly href: string }): ReactElement {
  return (
    <Link href={href} className={classOf(variant)} aria-label={accessibleName}>
      {icon !== undefined && <OrderIcon name={icon} size={20} />}
      {label}
    </Link>
  );
}
