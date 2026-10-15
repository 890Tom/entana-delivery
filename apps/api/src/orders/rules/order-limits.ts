const ORDER_RATE_LIMIT_WINDOW_MINUTES = 60;
const MAX_ORDERS_PER_WINDOW = 5;
export const MAX_CREATION_ATTEMPTS = 5;

const MILLISECONDS_PER_MINUTE = 60_000;

/** The start of the window in which a customer's orders are counted (inclusive). */
export function getRateLimitWindowStart(now: Date): Date {
  return new Date(now.getTime() - ORDER_RATE_LIMIT_WINDOW_MINUTES * MILLISECONDS_PER_MINUTE);
}

export function isRateLimited(recentOrderCount: number): boolean {
  return recentOrderCount >= MAX_ORDERS_PER_WINDOW;
}
