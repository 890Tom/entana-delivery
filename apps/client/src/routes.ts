/** The address of the cart screen: fixed, so that no input can ever change where a link leads. */
export const CART_PATH = "/panier";

/** The address of the delivery screen: fixed, like the cart's. */
export const DELIVERY_PATH = "/livraison";

/** The address of the contact details screen, the one after the delivery screen. */
export const CONTACT_PATH = "/coordonnees";

/** The address of the order review, the one after the contact details. */
export const REVIEW_PATH = "/recapitulatif";

/**
 * The tracking screen, where a confirmed order leads. A link to an order is this address with the
 * tracking token in the fragment (`#token`): a fragment is never sent to the server, and the
 * screen erases it from the address bar as soon as it has read it.
 */
export const TRACKING_PATH = "/suivi";

/**
 * Where a customer who has lost the tracking link finds the order again with the phone number
 * and the order code. Not a step of the order: it has no entry in `STEP_BY_PATH`. The values
 * typed there are never part of the address.
 */
export const FIND_ORDER_PATH = "/retrouver";

/**
 * The step of the order (0 is the first) that each screen belongs to. A screen listed here gets
 * the same step indicator as the others: a new screen of the order is added to this table. The
 * catalogue is not listed: choosing products is not a step of the order, and has no indicator.
 */
export const STEP_BY_PATH: Readonly<Record<string, number>> = {
  [CART_PATH]: 0,
  [DELIVERY_PATH]: 1,
  [CONTACT_PATH]: 2,
  [REVIEW_PATH]: 3,
  [TRACKING_PATH]: 4,
};
