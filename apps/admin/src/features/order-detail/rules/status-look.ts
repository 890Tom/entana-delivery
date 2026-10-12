import type { OrderStatus } from "@entana/contracts";

import type { OrderIconName } from "../../../order-display/order-icons";
import { texts } from "../../../i18n/texts";

export interface StatusLook {
  readonly label: string;
  readonly tone: "toProcess" | "confirmed" | "dark" | "light" | "success" | "danger";
  readonly icon: OrderIconName;
}

const status = texts.orders.status;

// A status is told by its text and its icon: the colour never says it alone. The icons of the
// new, refused, cancelled and failed statuses are to confirm.
export const STATUS_LOOKS: Readonly<Record<OrderStatus, StatusLook>> = {
  NEW: { label: texts.orders.tabs.toProcess, tone: "toProcess", icon: "circle-dot" },
  CONFIRMED: { label: status.confirmed, tone: "confirmed", icon: "calendar" },
  OUT_FOR_DELIVERY: { label: status.outForDelivery, tone: "dark", icon: "truck" },
  DELIVERED: { label: status.delivered, tone: "success", icon: "check" },
  REJECTED: { label: status.rejected, tone: "light", icon: "x" },
  CANCELLED: { label: status.cancelled, tone: "danger", icon: "ban" },
  FAILED: { label: status.failed, tone: "light", icon: "triangle-alert" },
};
