/** The request body is not of a type the route accepts. Thrown by the HTTP layer, before a service. */
export class UnsupportedContentTypeError extends Error {
  constructor() {
    super("The content type of the request is not supported.");
    this.name = "UnsupportedContentTypeError";
  }
}
