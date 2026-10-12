import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";

import { DetailButton } from "./detail-button";
import styles from "./modal-dialog.module.css";

interface ModalDialogProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly isBusy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

const FOCUSABLE = "button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])";

function focusablesOf(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/** Moves the focus into the dialog on opening; the opener takes it back when it closes. */
function useInitialFocus(dialogRef: { current: HTMLElement | null }): void {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null) {
      (focusablesOf(dialog)[0] ?? dialog).focus();
    }
  }, [dialogRef]);
}

/** Escape closes; Tab wraps at both ends, so that the key never leaves for the page behind. */
function handleKeys(
  event: KeyboardEvent<HTMLElement>,
  canClose: boolean,
  onCancel: () => void,
): void {
  if (event.key === "Escape") {
    event.stopPropagation();
    if (canClose) {
      onCancel();
    }
    return;
  }
  if (event.key !== "Tab") {
    return;
  }
  const items = focusablesOf(event.currentTarget);
  const first = items[0];
  const last = items.at(-1);
  if (first === undefined || last === undefined) {
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function DialogActions({
  cancelLabel,
  confirmLabel,
  isBusy,
  onCancel,
  onConfirm,
}: Omit<ModalDialogProps, "title" | "children">): ReactElement {
  return (
    <div className={styles.actions}>
      <DetailButton
        label={cancelLabel}
        variant="secondary"
        isDisabled={isBusy}
        onClick={onCancel}
      />
      <DetailButton
        label={confirmLabel}
        variant="danger"
        isDisabled={isBusy}
        isBusy={isBusy}
        onClick={onConfirm}
      />
    </div>
  );
}

/**
 * A modal dialog: a veil, a centred white card, the focus trapped inside, Escape to close. The
 * caller gives the focus back to its button when it closes the dialog.
 */
export function ModalDialog({ title, children, ...actions }: ModalDialogProps): ReactElement {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useInitialFocus(dialogRef);
  return (
    <div className={styles.veil}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.card}
        onKeyDown={(event) => {
          handleKeys(event, !actions.isBusy, actions.onCancel);
        }}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        <DialogActions {...actions} />
      </div>
    </div>
  );
}
