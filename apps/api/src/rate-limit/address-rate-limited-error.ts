/**
 * Too many requests came from one client: an address, or a key counted like one (an admin account,
 * a phone number of the order lookup). Thrown by every limit of the HTTP layer, so they all answer
 * the same 429 and a caller cannot tell them apart.
 */
export class AddressRateLimitedError extends Error {
  constructor() {
    super("Too many requests came from this address.");
    this.name = "AddressRateLimitedError";
  }
}
