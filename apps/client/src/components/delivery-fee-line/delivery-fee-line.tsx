import { formatAmount } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../i18n/texts";
import { Icon } from "../icon/icon";

import styles from "./delivery-fee-line.module.css";

/**
 * The delivery fee as one line: a truck, "Livraison", and "Gratuite" at 0 or the amount. It is
 * information, not a control. Shared by the screens of the order that show the fee.
 */
export function DeliveryFeeLine({ amountAr }: { amountAr: number }): ReactElement {
  return (
    <div className={styles.line}>
      <span className={styles.icon}>
        <Icon name="truck" />
      </span>
      <span className={styles.label}>{texts.delivery.fee.label}</span>
      <span className={styles.value}>
        {amountAr === 0 ? texts.delivery.fee.free : formatAmount(amountAr)}
      </span>
    </div>
  );
}
