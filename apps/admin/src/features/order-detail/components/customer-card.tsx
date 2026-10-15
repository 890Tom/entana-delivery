import type { AdminOrderDetail } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { useInstance } from "../../instance/hooks/use-instance";
import { OrderIcon } from "../../../order-display/order-icons";
import { formatPhone } from "../../../order-display/format-order";

import card from "../../../components/card/card.module.css";
import styles from "./customer-card.module.css";

const t = texts.orderDetail.customer;

/** The name, the number in the national form and a link that dials it in the international form. */
export function CustomerCard({ order }: { order: AdminOrderDetail }): ReactElement {
  const instance = useInstance();
  const display =
    instance.data === undefined
      ? order.phone
      : formatPhone(order.phone, instance.data.phoneCountryCode);
  return (
    <section aria-labelledby="customer-title" className={card.card}>
      <h2 id="customer-title" className={[card.title, styles.label].join(" ")}>
        {t.title}
      </h2>
      <p className={styles.name}>{order.contactName}</p>
      <div className={styles.contact}>
        <p className={styles.phone}>{display}</p>
        <a
          href={`tel:${order.phone}`}
          className={styles.call}
          aria-label={t.callLabel(order.contactName, display)}
        >
          <OrderIcon name="phone" size={20} />
          {t.call}
        </a>
      </div>
    </section>
  );
}
