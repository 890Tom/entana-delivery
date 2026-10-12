import type { ReactElement } from "react";

import { ActionButton } from "./action-button";
import styles from "./load-more-button.module.css";

interface LoadMoreButtonProps {
  readonly label: string;
  /** What is left, written beside the button ("3 autres à traiter"). */
  readonly remaining?: string;
  readonly isLoading: boolean;
  readonly onClick: () => void;
}

/** The "show more" of the cards and of the table: one component, one way to ask for a page. */
export function LoadMoreButton({
  label,
  remaining,
  isLoading,
  onClick,
}: LoadMoreButtonProps): ReactElement {
  return (
    <div className={styles.row}>
      <ActionButton
        label={label}
        variant="secondary"
        icon="chevron-down"
        isDisabled={isLoading}
        isBusy={isLoading}
        onClick={onClick}
      />
      {remaining !== undefined && <span className={styles.remaining}>{remaining}</span>}
    </div>
  );
}
