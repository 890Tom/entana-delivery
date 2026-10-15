import type { AdminOrderDetail } from "@entana/contracts";
import { useRef, useState } from "react";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import type { StatusChange } from "./use-status-change";

import { DetailButton } from "../../../components/detail-button/detail-button";
import { ModalDialog } from "../../../components/modal-dialog/modal-dialog";

const t = texts.orderDetail;

function FailDialog({
  order,
  change,
  onClose,
}: {
  order: AdminOrderDetail;
  change: StatusChange;
  onClose: () => void;
}): ReactElement {
  return (
    <ModalDialog
      title={t.dialog.failTitle(order.publicCode)}
      cancelLabel={t.dialog.cancel}
      confirmLabel={t.dialog.failConfirm}
      isBusy={change.isSending}
      onCancel={onClose}
      onConfirm={() => {
        void change.send({ to: "FAILED" }).then(onClose);
      }}
    >
      <p>{t.dialog.failBody}</p>
    </ModalDialog>
  );
}

/** "Livraison échouée…": a plain confirmation, no reason (the server stores a fixed one). */
export function FailAction({
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
        label={t.decision.failDelivery}
        variant="dangerOutline"
        isDisabled={change.isSending}
        onClick={() => {
          setIsOpen(true);
        }}
      />
      {isOpen && (
        <FailDialog
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
