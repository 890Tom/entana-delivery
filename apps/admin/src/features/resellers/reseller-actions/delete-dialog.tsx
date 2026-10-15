import type { AdminReseller } from "@entana/contracts";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";

import { texts } from "../../../i18n/texts";
import { ModalDialog } from "../../../components/modal-dialog/modal-dialog";

const t = texts.resellers.form.dialog;

/** The question before a reseller is deleted for good. */
export function DeleteDialog({
  reseller,
  isBusy,
  onCancel,
  onConfirm,
}: {
  reseller: AdminReseller;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  return createPortal(
    <ModalDialog
      title={t.title(reseller.name)}
      cancelLabel={t.cancel}
      confirmLabel={t.confirm}
      isBusy={isBusy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p>{t.body}</p>
    </ModalDialog>,
    document.body,
  );
}
