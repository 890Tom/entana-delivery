import { MAX_STATUS_REASON_LENGTH } from "@entana/contracts";
import type { AdminOrderDetail } from "@entana/contracts";
import { useId, useRef, useState } from "react";
import type { ReactElement } from "react";

import { NoticeIcon } from "../../../components/notice/notice-icons";
import { texts } from "../../../i18n/texts";
import type { StatusChange } from "../hooks/use-status-change";
import { readReason } from "../rules/read-reason";

import { DetailButton } from "../../../components/detail-button/detail-button";
import { ModalDialog } from "../../../components/modal-dialog/modal-dialog";
import styles from "./reject-action.module.css";

const t = texts.orderDetail;

function ReasonField({
  value,
  hasError,
  onChange,
}: {
  value: string;
  hasError: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {t.dialog.reasonLabel}
      </label>
      <textarea
        id={id}
        className={[styles.control, hasError ? styles.invalid : ""].join(" ")}
        rows={3}
        value={value}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={helpId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <p id={helpId} className={styles.help}>
        {t.dialog.reasonHelp}
      </p>
      {hasError && (
        <p role="alert" className={styles.error}>
          <NoticeIcon name="circle-alert" />
          {t.dialog.reasonTooLong(MAX_STATUS_REASON_LENGTH)}
        </p>
      )}
    </div>
  );
}

interface RejectDialogProps {
  readonly order: AdminOrderDetail;
  readonly change: StatusChange;
  readonly onClose: () => void;
}

function RejectDialog({ order, change, onClose }: RejectDialogProps): ReactElement {
  const [typed, setTyped] = useState("");
  const [hasError, setHasError] = useState(false);

  const confirm = (): void => {
    const reading = readReason(typed);
    if (reading.kind === "too_long") {
      setHasError(true);
      return;
    }
    const request =
      reading.reason === undefined
        ? ({ to: "REJECTED" } as const)
        : ({ to: "REJECTED", reason: reading.reason } as const);
    // Closed whatever the answer: a failure is said in the card, which the modal would hide.
    void change.send(request).then(onClose);
  };

  return (
    <ModalDialog
      title={t.dialog.rejectTitle(order.publicCode)}
      cancelLabel={t.dialog.cancel}
      confirmLabel={t.dialog.rejectConfirm}
      isBusy={change.isSending}
      onCancel={onClose}
      onConfirm={confirm}
    >
      <ReasonField
        value={typed}
        hasError={hasError}
        onChange={(value) => {
          setTyped(value);
          setHasError(false);
        }}
      />
    </ModalDialog>
  );
}

/** "Refuser…" and its modal: an optional reason, left out of the request when it is empty. */
export function RejectAction({
  order,
  change,
}: {
  order: AdminOrderDetail;
  change: StatusChange;
}): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <DetailButton
        ref={buttonRef}
        label={t.decision.reject}
        variant="dangerOutline"
        isDisabled={change.isSending}
        onClick={() => {
          setIsOpen(true);
        }}
      />
      {isOpen && (
        <RejectDialog
          order={order}
          change={change}
          onClose={() => {
            setIsOpen(false);
            buttonRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
