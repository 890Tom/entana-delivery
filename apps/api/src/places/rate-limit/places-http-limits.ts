/**
 * The place search: at most this many requests per address in the window. A search as you type
 * sends several requests per address looked up.
 */
export const PLACES_SEARCH_MAX_REQUESTS = 60;
export const PLACES_SEARCH_WINDOW_MS = 10 * 60_000;
/** Addresses tracked at once. Beyond it the least recently seen one that is not limited goes. */
export const PLACES_SEARCH_MAX_TRACKED = 10_000;

/** Where the route and its limit are mounted: the global prefix, the version and the route. */
export const PLACES_SEARCH_PATH = "/api/v1/places/search";
