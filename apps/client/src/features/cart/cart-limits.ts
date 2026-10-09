// The limits of the order request (MAX_ITEMS and MAX_QUANTITY in create-order-request.ts of
// @entana/contracts, which does not export them): a cart above them could not be ordered.
export const MAX_CART_PRODUCTS = 30;
export const MAX_LINE_QUANTITY = 99;
