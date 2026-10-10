import { formatAmount } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../i18n/texts";
import { Icon } from "../icon/icon";

import styles from "./delivery-fee-line.module.css";

interface DeliveryFeeLineProps {
  readonly amountAr: number;
  /**
   * "highlighted": a truck on a muted row, for the delivery screen. "plain": the muted words of
   * a row of the order summary, with no icon and no fill.
   */
  readonly variant?: "highlighted" | "plain";
}

/**
 * The delivery fee as one line: "Livraison", and "Gratuite" at 0 or the amount. It is
 * information, not a control. Shared by the screens of the order that show the fee.
 */
export function DeliveryFeeLine({
  amountAr,
  variant = "highlighted",
}: DeliveryFeeLineProps): ReactElement {
  return (
    <div className={[styles.line, variant === "plain" ? styles.plain : ""].join(" ")}>
      {variant === "highlighted" && (
        <span className={styles.icon}>
          <Icon name="truck" />
        </span>
      )}
      <span className={styles.label}>{texts.delivery.fee.label}</span>
      <span className={styles.value}>
        {amountAr === 0 ? texts.delivery.fee.free : formatAmount(amountAr)}
      </span>
    </div>
  );
}
