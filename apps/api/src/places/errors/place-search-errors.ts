/**
 * The place search provider did not give a usable answer: a network error, a timeout, a status
 * other than 2xx or a body of the wrong shape. The cause is not kept: it can hold the URL of the
 * request, hence the searched text.
 */
export class PlaceSearchUnavailableError extends Error {
  constructor() {
    super("The place search provider did not give a usable answer.");
    this.name = "PlaceSearchUnavailableError";
  }
}
