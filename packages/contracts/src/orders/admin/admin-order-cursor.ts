const CURSOR_PATTERN = /^[0-9a-f]{32}$/;

/**
 * The cursor is the id of the last order of a page, written without its hyphens. Ids are uuidv7:
 * ordered by creation, so "older than this id" is the next page. A client treats it as opaque.
 */
export function encodeOrderCursor(orderId: string): string {
  return orderId.replace(/-/g, "");
}

/** The order id of a cursor, or null when the text is not a cursor this API issued. */
export function decodeOrderCursor(cursor: string): string | null {
  if (!CURSOR_PATTERN.test(cursor)) {
    return null;
  }
  return [
    cursor.slice(0, 8),
    cursor.slice(8, 12),
    cursor.slice(12, 16),
    cursor.slice(16, 20),
    cursor.slice(20),
  ].join("-");
}
