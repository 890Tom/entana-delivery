/**
 * No valid session, or a login that failed. One class and one answer for every cause: an unknown
 * account, a wrong password, a disabled account, a driver, a missing, expired or revoked session.
 */
export class AdminUnauthenticatedError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AdminUnauthenticatedError";
  }
}

/** A request that changes something came from an origin that is not the administration. */
export class AdminOriginRefusedError extends Error {
  constructor() {
    super("The origin of the request is not allowed.");
    this.name = "AdminOriginRefusedError";
  }
}
