import type { OrderStatus } from "@entana/contracts";

export const ORDER_TABS = [
  "all",
  "toProcess",
  "confirmed",
  "outForDelivery",
  "delivered",
  "closed",
] as const;

export type OrderTab = (typeof ORDER_TABS)[number];

export const DEFAULT_TAB: OrderTab = "all";

const OTHER_STATUSES: readonly OrderStatus[] = [
  "CONFIRMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "REJECTED",
  "CANCELLED",
  "FAILED",
];

/** The statuses the table of a tab asks for; null when the tab has no table (À traiter). */
export function tableStatuses(tab: OrderTab): readonly OrderStatus[] | null {
  switch (tab) {
    case "all":
      return OTHER_STATUSES;
    case "toProcess":
      return null;
    case "confirmed":
      return ["CONFIRMED"];
    case "outForDelivery":
      return ["OUT_FOR_DELIVERY"];
    case "delivered":
      return ["DELIVERED"];
    case "closed":
      return ["REJECTED", "CANCELLED", "FAILED"];
  }
}

/** The cards "À traiter" are shown in two tabs only. */
export function hasToProcessSection(tab: OrderTab): boolean {
  return tab === "all" || tab === "toProcess";
}

/** Only the tabs of one status can select every loaded row at once. */
export function canSelectAll(tab: OrderTab): boolean {
  return tab === "confirmed" || tab === "outForDelivery";
}
