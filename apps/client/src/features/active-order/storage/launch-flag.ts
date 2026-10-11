export const LAUNCH_FLAG_STORAGE_ITEM = "entana.launch-handled.v1";

/**
 * True once the launch of this browsing session was looked at. A storage that cannot be read
 * counts as handled: without the flag a reload would send the customer away again.
 */
export function isLaunchHandled(): boolean {
  try {
    return window.sessionStorage.getItem(LAUNCH_FLAG_STORAGE_ITEM) !== null;
  } catch {
    return true;
  }
}

/** The only thing this feature writes besides forgetting an order the server no longer knows. */
export function markLaunchHandled(): void {
  try {
    window.sessionStorage.setItem(LAUNCH_FLAG_STORAGE_ITEM, "1");
  } catch {
    // Private browsing: the check is then simply made again at the next opening.
  }
}
