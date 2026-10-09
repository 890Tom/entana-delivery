import type { ReactElement, Ref } from "react";

import { Icon } from "../icon/icon";
import type { IconName } from "../icon/icon";

import styles from "./icon-button.module.css";

interface IconButtonProps {
  readonly icon: IconName;
  /** Required: an icon alone names nothing. */
  readonly label: string;
  readonly isDisabled?: boolean;
  readonly onClick: () => void;
  readonly ref?: Ref<HTMLButtonElement>;
}

/** A square ghost button, for the steppers. Disabled means `aria-disabled`, as for `Button`. */
export function IconButton({
  icon,
  label,
  isDisabled = false,
  onClick,
  ref,
}: IconButtonProps): ReactElement {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.button}
      aria-label={label}
      title={label}
      aria-disabled={isDisabled ? true : undefined}
      onClick={isDisabled ? undefined : onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
