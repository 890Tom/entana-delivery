/** POST /api/v1/orders: at most this many requests per address in the window. Replays count. */
export const ADDRESS_MAX_REQUESTS = 20;
export const ADDRESS_WINDOW_MS = 10 * 60_000;
/** Addresses tracked at once. Beyond it the least recently seen one that is not limited goes. */
export const ADDRESS_MAX_TRACKED = 10_000;

// Retry-After is the length of the window, never the exact time left: the exact time would tell a
// caller when the oldest of its recent requests (or orders, for a phone number) was made.
export const ADDRESS_RETRY_AFTER_SECONDS = 600;
/** The per-phone limit counts the orders of the last hour (see order-limits.ts). */
export const PHONE_RETRY_AFTER_SECONDS = 3600;

/** Where the limit per address is mounted: the global prefix, the version and the route. */
export const ORDER_CREATION_PATH = "/api/v1/orders";
