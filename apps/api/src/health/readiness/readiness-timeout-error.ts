/** The database did not answer in time. Internal: it is classified for the log, never sent. */
export class ReadinessTimeoutError extends Error {
  constructor() {
    super("The readiness check timed out.");
    this.name = "ReadinessTimeoutError";
  }
}
