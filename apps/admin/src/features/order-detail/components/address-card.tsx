import type { AdminOrderDetail } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";

import styles from "./address-card.module.css";
import card from "./card.module.css";
import { OrderMap } from "./order-map";

const t = texts.orderDetail.address;

/** The landmark the customer wrote and the delivery point on the map. */
export function AddressCard({ order }: { order: AdminOrderDetail }): ReactElement {
  return (
    <section aria-labelledby="address-title" className={card.card}>
      <h2 id="address-title" className={[card.title, styles.label].join(" ")}>
        {t.title}
      </h2>
      <p className={styles.landmark}>{t.landmark(order.landmarkText)}</p>
      <OrderMap lat={order.latitude} lng={order.longitude} />
    </section>
  );
}
