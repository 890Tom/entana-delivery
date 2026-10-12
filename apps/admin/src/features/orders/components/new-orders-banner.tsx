import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import type { NewOrders } from "../hooks/use-new-orders";

import { OrderIcon } from "../../../order-display/order-icons";
import styles from "./new-orders-banner.module.css";

type Banner = NonNullable<NewOrders["banner"]>;

function message({ count, latest }: Banner): string {
  return count === 1 && latest !== null
    ? texts.orders.banner.one(latest.publicCode, latest.customerName)
    : texts.orders.banner.many(count);
}

/** New orders came in: the list does not move by itself, the person decides when to reload. */
export function NewOrdersBanner({
  banner,
  onShow,
}: {
  banner: Banner;
  onShow: () => void;
}): ReactElement {
  return (
    <div role="status" className={styles.banner}>
      <OrderIcon name="bell" size={20} />
      <p className={styles.text}>{message(banner)}</p>
      <button type="button" className={styles.show} onClick={onShow}>
        {texts.orders.banner.show}
      </button>
    </div>
  );
}
