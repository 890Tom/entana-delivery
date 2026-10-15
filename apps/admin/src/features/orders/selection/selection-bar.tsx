import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import type { Selection } from "../rules/selection";

import { ActionButton } from "../action-button/action-button";
import styles from "./selection-bar.module.css";

/** Shown as soon as one order is ticked: how many, the one action they share, and the way out. */
export function SelectionBar({
  selection,
  isRunning,
  onRun,
  onCancel,
}: {
  selection: Selection;
  isRunning: boolean;
  onRun: () => void;
  onCancel: () => void;
}): ReactElement {
  const count = selection.ids.length;
  const s = texts.orders.selection;
  const label = selection.status === "CONFIRMED" ? s.startDelivery(count) : s.markDelivered(count);
  return (
    <section className={styles.bar} aria-label={s.region}>
      <p className={styles.count} aria-live="polite">
        {s.count(count)}
      </p>
      <ActionButton
        label={label}
        variant="primary"
        isDisabled={isRunning}
        isBusy={isRunning}
        onClick={onRun}
      />
      <ActionButton label={s.cancel} variant="quiet" isDisabled={isRunning} onClick={onCancel} />
    </section>
  );
}
