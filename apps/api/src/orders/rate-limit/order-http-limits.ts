/** POST /api/v1/orders: at most this many requests per address in the window. Replays count. */
export const ADDRESS_MAX_REQUESTS = 20;
export const ADDRESS_WINDOW_MS = 10 * 60_000;
/** Addresses tracked at once. Beyond it the least recently seen one that is not limited goes. */
export const ADDRESS_MAX_TRACKED = 10_000;

// One Retry-After for both 429 answers (address limit and phone limit): two values would let a
// caller tell the two limits apart. It is a fixed value, never the exact time left, which would
// reveal when the oldest recent request or order was made.
export const RATE_LIMIT_RETRY_AFTER_SECONDS = 600;

/** Where the limit per address is mounted: the global prefix, the version and the route. */
export const ORDER_CREATION_PATH = "/api/v1/orders";
