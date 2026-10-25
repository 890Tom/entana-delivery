import { dayInTimeZone } from "@entana/contracts";
import { useId, useState } from "react";
import type { ReactElement } from "react";
import { useLocation } from "wouter";

import { Button } from "../../../components/button/button";
import { texts } from "../../../i18n/texts";
import { TRACKING_PATH } from "../../../routes";
import { readConfirmedOrders } from "../../order-submission/storage/confirmed-orders-storage";
import type { ConfirmedOrder } from "../../order-submission/storage/confirmed-orders-storage";
import { formatDeliveryDate } from "../../tracking/rules/format-delivery-date";

import styles from "../find-order-screen.module.css";

// The client does not know the shop's time zone: the day is the one the customer saw on the device.
const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const formatOrderDay = (order: ConfirmedOrder): string =>
  formatDeliveryDate(dayInTimeZone(new Date(order.createdAt), DEVICE_TIME_ZONE));

/**
 * The orders this device remembers, the newest first, read once when the screen opens. Each one
 * opens its tracking by the address of a tracking link; the token is only read when a button is
 * pressed, and is in no text and no attribute of the page. Nothing when the device remembers none.
 */
export function DeviceOrders(): ReactElement | null {
  const [orders] = useState(() => readConfirmedOrders(Date.now()));
  const [, navigate] = useLocation();
  const titleId = useId();
  if (orders.length === 0) {
    return null;
  }
  const { deviceOrders } = texts.findOrder;
  return (
    <section className={styles.deviceOrders} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.subtitle}>
        {deviceOrders.title}
      </h2>
      <ul className={styles.deviceOrderList} aria-labelledby={titleId}>
        {orders.map((order) => (
          <li key={order.token}>
            <Button
              onClick={() => {
                navigate(`${TRACKING_PATH}#${order.token}`);
              }}
            >
              {deviceOrders.order(order.code, formatOrderDay(order))}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
