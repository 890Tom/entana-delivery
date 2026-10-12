import type { AdminOrderListItem, OrderStatus } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { formatDay } from "../rules/format-order";

import { OrderIcon } from "./order-icons";
import type { OrderIconName } from "./order-icons";
import styles from "./status-pill.module.css";

interface Look {
  readonly label: string;
  readonly className: string | undefined;
  readonly icon: OrderIconName | null;
}

const t = texts.orders.status;

// A status is told by its text and its icon: the colour never says it alone. A refused,
// cancelled or failed order has no icon of its own in the sources (to confirm).
const LOOKS: Readonly<Record<OrderStatus, Look>> = {
  NEW: { label: texts.orders.tabs.toProcess, className: styles.light, icon: null },
  CONFIRMED: { label: t.confirmed, className: styles.confirmed, icon: "calendar" },
  OUT_FOR_DELIVERY: { label: t.outForDelivery, className: styles.dark, icon: "truck" },
  DELIVERED: { label: t.delivered, className: styles.success, icon: "check" },
  REJECTED: { label: t.rejected, className: styles.light, icon: null },
  CANCELLED: { label: t.cancelled, className: styles.danger, icon: null },
  FAILED: { label: t.failed, className: styles.light, icon: null },
};

function labelOf(order: AdminOrderListItem): string {
  if (order.status === "CONFIRMED" && order.deliveryDate !== null) {
    return t.confirmedOn(formatDay(order.deliveryDate));
  }
  return LOOKS[order.status].label;
}

export function StatusPill({ order }: { order: AdminOrderListItem }): ReactElement {
  const { className, icon } = LOOKS[order.status];
  return (
    <span className={[styles.pill, className].join(" ")}>
      {icon !== null && <OrderIcon name={icon} size={16} />}
      {labelOf(order)}
    </span>
  );
}
