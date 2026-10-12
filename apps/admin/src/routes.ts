/** The sign-in screen, the only public address. */
export const LOGIN_PATH = "/connexion";

/** The root address: it leads to the orders list. */
export const HOME_PATH = "/";

/** The orders list, the first screen of the administration. */
export const ORDERS_PATH = "/commandes";

/** The sheet of one order (not built yet: the address leads to the not found page). */
export function orderPath(orderId: string): string {
  return `${ORDERS_PATH}/${encodeURIComponent(orderId)}`;
}
