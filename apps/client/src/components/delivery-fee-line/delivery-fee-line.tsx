import type { DeliveryQuoteResponse } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../i18n/texts";
import { Icon } from "../icon/icon";
import { Notice } from "../notice/notice";
import visuallyHidden from "../visually-hidden/visually-hidden.module.css";

import { describeDeliveryFee } from "./describe-delivery-fee";
import styles from "./delivery-fee-line.module.css";

/** The fee as the server gives it: being computed, failed (with a retry), or known. */
type DeliveryFeeState =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly onRetry: () => void }
  | { readonly status: "ready"; readonly quote: DeliveryQuoteResponse };

type Variant = "highlighted" | "plain";

interface DeliveryFeeLineProps {
  readonly state: DeliveryFeeState;
  /**
   * "highlighted": a truck on a muted row, for the delivery screen. "plain": the muted words of
   * a row of the order summary, with no icon and no fill.
   */
  readonly variant?: Variant;
}

const lineClass = (variant: Variant): string =>
  [styles.line, variant === "plain" ? styles.plain : ""].join(" ");

function TruckIcon({ variant }: { variant: Variant }): ReactElement | null {
  return variant === "highlighted" ? (
    <span className={styles.icon}>
      <Icon name="truck" />
    </span>
  ) : null;
}

/** The row of the loaded line as blocks, so that the answer moves nothing. */
function FeeSkeleton({ variant }: { variant: Variant }): ReactElement {
  return (
    <div aria-busy="true" className={lineClass(variant)}>
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
      <TruckIcon variant={variant} />
      <span aria-hidden="true" className={[styles.block, styles.labelBlock].join(" ")} />
      <span aria-hidden="true" className={[styles.block, styles.valueBlock].join(" ")} />
    </div>
  );
}

function FeeRow({
  quote,
  variant,
}: {
  quote: DeliveryQuoteResponse;
  variant: Variant;
}): ReactElement {
  const { label, value, note } = describeDeliveryFee(quote);
  return (
    <div className={styles.group}>
      <div className={lineClass(variant)}>
        <TruckIcon variant={variant} />
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
      </div>
      {note !== null && <p className={styles.note}>{note}</p>}
    </div>
  );
}

/**
 * The delivery fee of the server's quote as one line, and the note that may follow it. It is
 * information, not a control. Shared by the screens of the order that show the fee; the screen
 * that changes it puts it in a polite live region.
 */
export function DeliveryFeeLine({
  state,
  variant = "highlighted",
}: DeliveryFeeLineProps): ReactElement {
  switch (state.status) {
    case "loading":
      return <FeeSkeleton variant={variant} />;
    case "failed":
      // Announced by the live region around the line, not a second time by an alert.
      return (
        <Notice
          tone="error"
          isAnnounced={false}
          action={{ label: texts.common.retry, onClick: state.onRetry }}
        >
          {texts.delivery.fee.failed}
        </Notice>
      );
    case "ready":
      return <FeeRow quote={state.quote} variant={variant} />;
  }
}
