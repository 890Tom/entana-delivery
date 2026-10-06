/**
 * The API cannot serve requests that need a dependency. It carries nothing: the answer is fixed
 * (see toProblemDetails) because readiness is public and must not reveal what the API depends on.
 */
export class ServiceNotReadyError extends Error {
  constructor() {
    super("The service is not ready.");
    this.name = "ServiceNotReadyError";
  }
}
