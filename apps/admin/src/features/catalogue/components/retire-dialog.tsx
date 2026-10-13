import type { AdminProduct } from "@entana/contracts";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";

import { texts } from "../../../i18n/texts";
import { ModalDialog } from "../../order-detail/components/modal-dialog";

const t = texts.catalogue;

/** The question before a product leaves the catalogue. */
export function RetireDialog({
  product,
  isBusy,
  onCancel,
  onConfirm,
}: {
  product: AdminProduct;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  // In the body: a dialog inside a table row would be invalid markup, and a transformed row
  // (while it is dragged) would become the reference of its fixed position.
  return createPortal(
    <ModalDialog
      title={t.dialog.title(product.name)}
      cancelLabel={t.dialog.cancel}
      confirmLabel={t.dialog.confirm}
      isBusy={isBusy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p>{t.dialog.body}</p>
    </ModalDialog>,
    document.body,
  );
}
