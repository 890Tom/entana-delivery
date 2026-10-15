import type { MouseEvent, ReactElement, ReactNode } from "react";
import { Link } from "wouter";

import styles from "./form-buttons.module.css";

type Variant = "primary" | "ghost" | "secondary" | "dangerGhost";

interface CommonProps {
  readonly label: string;
  readonly variant: Variant;
  readonly icon?: ReactNode;
  /** Disabled, it stays focusable (`aria-disabled`) and does nothing. */
  readonly isDisabled?: boolean;
}

interface ButtonProps extends CommonProps {
  readonly type?: "button" | "submit";
  readonly isBusy?: boolean;
  readonly onClick?: () => void;
}

const classNameOf = (variant: Variant): string => [styles.action, styles[variant]].join(" ");

/** A button of the product form. A disabled one never submits nor clicks. */
export function FormButton({
  label,
  variant,
  icon,
  isDisabled = false,
  isBusy = false,
  type = "button",
  onClick,
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      className={classNameOf(variant)}
      aria-disabled={isDisabled ? true : undefined}
      aria-busy={isBusy ? true : undefined}
      onClick={(event: MouseEvent) => {
        if (isDisabled) {
          event.preventDefault();
          return;
        }
        onClick?.();
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/** A link that looks like a button of the form ("Annuler", "Ajouter un produit"). */
export function FormLink({
  label,
  variant,
  icon,
  isDisabled = false,
  href,
}: CommonProps & { readonly href: string }): ReactElement {
  return (
    <Link
      href={href}
      className={classNameOf(variant)}
      aria-disabled={isDisabled ? true : undefined}
      onClick={(event) => {
        if (isDisabled) {
          event.preventDefault();
        }
      }}
    >
      {icon}
      {label}
    </Link>
  );
}
