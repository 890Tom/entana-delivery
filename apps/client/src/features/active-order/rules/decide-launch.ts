export interface LaunchFacts {
  /** The launch of this browsing session was already looked at (the session flag is set). */
  readonly isHandled: boolean;
  /** The path the application was opened on. */
  readonly path: string;
  /** The device remembers at least one order. */
  readonly hasOrder: boolean;
  readonly isCartEmpty: boolean;
}

/**
 * Whether the opening of the application may lead back to the tracking of an order: only the
 * first one of a session, only on the catalogue's own address, and only for a customer with
 * nothing in the cart. A deep link, or a later visit to the catalogue, never does.
 */
export function shouldCheckLaunch(facts: LaunchFacts): boolean {
  return !facts.isHandled && facts.path === "/" && facts.hasOrder && facts.isCartEmpty;
}
