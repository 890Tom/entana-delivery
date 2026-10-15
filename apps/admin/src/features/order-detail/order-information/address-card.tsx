import type { AdminOrderDetail } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";

import styles from "./address-card.module.css";
import card from "../../../components/card/card.module.css";
import { OrderMap } from "../map/order-map";

const t = texts.orderDetail.address;

/** The place in bold and its axis beside it, muted; « Hors axe » for an order outside every axis. */
function Zone({ zone }: { zone: AdminOrderDetail["deliveryZone"] }): ReactElement {
  if (zone === null) {
    return <p className={styles.zone}>{t.outsideAxis}</p>;
  }
  return (
    <p className={styles.zone}>
      <span className={styles.place}>{zone.placeName}</span>{" "}
      <span className={styles.axis}>{zone.axisName}</span>
    </p>
  );
}

/** The zone, the landmark the customer wrote and the delivery point on the map. */
export function AddressCard({ order }: { order: AdminOrderDetail }): ReactElement {
  return (
    <section aria-labelledby="address-title" className={card.card}>
      <h2 id="address-title" className={[card.title, styles.label].join(" ")}>
        {t.title}
      </h2>
      <Zone zone={order.deliveryZone} />
      <p className={styles.landmark}>{t.landmark(order.landmarkText)}</p>
      <OrderMap lat={order.latitude} lng={order.longitude} />
    </section>
  );
}
