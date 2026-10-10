/** The address of the cart screen: fixed, so that no input can ever change where a link leads. */
export const CART_PATH = "/panier";

/** The address of the delivery screen: fixed, like the cart's. */
export const DELIVERY_PATH = "/livraison";

/**
 * The address of the contact details screen, the one after the delivery screen. Nothing is
 * served there yet: the address leads to the "not found" page until that screen exists.
 */
export const CONTACT_PATH = "/coordonnees";

/**
 * The step of the order (0 is the first) that each screen belongs to. A screen listed here gets
 * the same step indicator as the others: a new screen of the order is added to this table. The
 * catalogue is not listed: choosing products is not a step of the order, and has no indicator.
 */
export const STEP_BY_PATH: Readonly<Record<string, number>> = {
  [CART_PATH]: 0,
  [DELIVERY_PATH]: 1,
};
