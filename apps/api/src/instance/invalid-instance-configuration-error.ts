/**
 * Thrown at startup when the instance configuration cannot be used. The message is in French (it
 * is read by the person who deploys) and names keys, never values or file content.
 */
export class InvalidInstanceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInstanceConfigurationError";
  }
}
