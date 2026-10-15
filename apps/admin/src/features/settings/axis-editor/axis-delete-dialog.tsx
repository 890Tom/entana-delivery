import type { ReactElement } from "react";
import { createPortal } from "react-dom";

import { texts } from "../../../i18n/texts";
import { ModalDialog } from "../../../components/modal-dialog/modal-dialog";

const t = texts.settings.axisEditor.dialog;

/** The question before an axis is deleted: its places stay. */
export function AxisDeleteDialog({
  name,
  isBusy,
  onCancel,
  onConfirm,
}: {
  name: string;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  return createPortal(
    <ModalDialog
      title={t.title(name)}
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
