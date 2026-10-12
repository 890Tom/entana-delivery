/** The sign-in screen, the only public address. */
export const LOGIN_PATH = "/connexion";

/** The root address: it leads to the orders list. */
export const HOME_PATH = "/";

/** The orders list, the first screen of the administration. */
export const ORDERS_PATH = "/commandes";

/** The pattern of the sheet of one order. */
export const ORDER_PATH_PATTERN = `${ORDERS_PATH}/:id`;

/** The address of the sheet of one order. */
export function orderPath(orderId: string): string {
  return `${ORDERS_PATH}/${encodeURIComponent(orderId)}`;
}

/** The catalogue of products, the second section of the administration. */
export const CATALOGUE_PATH = "/catalogue";
