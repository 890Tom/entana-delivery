/** The tracking routes: at most this many requests per address in the window (reads and cancels). */
export const TRACKING_MAX_REQUESTS = 120;
export const TRACKING_WINDOW_MS = 10 * 60_000;
/** Addresses tracked at once. Beyond it the least recently seen one that is not limited goes. */
export const TRACKING_MAX_TRACKED = 10_000;

/** Where the routes and their limit are mounted: the global prefix, the version and the route. */
export const TRACKING_PATH = "/api/v1/tracking";
