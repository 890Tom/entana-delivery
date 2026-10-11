/** The tracking routes: at most this many requests per address in the window (reads and cancels). */
export const TRACKING_MAX_REQUESTS = 120;
export const TRACKING_WINDOW_MS = 10 * 60_000;
/** Addresses tracked at once. Beyond it the least recently seen one that is not limited goes. */
export const TRACKING_MAX_TRACKED = 10_000;

/** Where the routes and their limit are mounted: the global prefix, the version and the route. */
export const TRACKING_PATH = "/api/v1/tracking";

/**
 * The lookup by phone number and order code, per address. Far below the tracking routes: the
 * order code is not a secret (32^6 values), so this route is the one that can be brute forced.
 */
export const TRACKING_LOOKUP_MAX_REQUESTS = 10;
export const TRACKING_LOOKUP_WINDOW_MS = 10 * 60_000;

/**
 * The lookup per phone number, whatever the address: it is what stops a distributed guess of the
 * codes of one customer. The window is longer than the one of an address on purpose.
 */
export const TRACKING_LOOKUP_PHONE_MAX_ATTEMPTS = 10;
export const TRACKING_LOOKUP_PHONE_WINDOW_MS = 60 * 60_000;

export const TRACKING_LOOKUP_PATH = "/api/v1/tracking/lookup";
