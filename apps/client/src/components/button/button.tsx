import type { ReactElement, Ref } from "react";
import { Link } from "wouter";

import { Icon } from "../icon/icon";
import type { IconName } from "../icon/icon";

import styles from "./button.module.css";

type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "danger";

interface ButtonLook {
  readonly children: string;
  readonly icon?: IconName;
  /**
   * "primary" is the ink button, "accent" the soft gold of the owner's design for "Utiliser ma
   * position", "ghost" a bold text without border and "danger" the confirmation of a final action.
   */
  readonly variant?: ButtonVariant;
}

interface ButtonProps extends ButtonLook {
  /** Names the button for assistive technology when the visible label is not enough. */
  readonly label?: string;
  readonly isDisabled?: boolean;
  readonly onClick: () => void;
  readonly ref?: Ref<HTMLButtonElement>;
}

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary: styles.primary ?? "",
  secondary: "",
  accent: styles.accent ?? "",
  ghost: styles.ghost ?? "",
  danger: styles.danger ?? "",
};

function toClassName(variant: ButtonVariant): string {
  return [styles.button, VARIANT_CLASSES[variant]].join(" ");
}

/**
 * The full-width button of the design system. A disabled one stays focusable
 * (`aria-disabled`, not `disabled`): the focus is not lost when it becomes disabled, and it is
 * announced as unavailable.
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
      className={toClassName(variant)}
      aria-label={label}
      aria-disabled={isDisabled ? true : undefined}
      onClick={isDisabled ? undefined : onClick}
    >
      {icon !== undefined && <Icon name={icon} />}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ButtonLook {
  /** A fixed address of the application, or a `tel:` link: never taken from an input. */
  readonly href: string;
}

/** A link with the look of a button: a telephone link, or a link to another screen. */
export function ButtonLink({
  children,
  icon,
  variant = "secondary",
  href,
}: ButtonLinkProps): ReactElement {
  const content = (
    <>
      {icon !== undefined && <Icon name={icon} />}
      {children}
    </>
  );
  return href.startsWith("tel:") ? (
    <a href={href} className={toClassName(variant)}>
      {content}
    </a>
  ) : (
    <Link href={href} className={toClassName(variant)}>
      {content}
    </Link>
  );
}
