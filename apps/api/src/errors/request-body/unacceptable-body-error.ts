/** A parsed JSON body the application refuses to read (a `__proto__` key, too deep, too large). */
export class UnacceptableBodyError extends Error {
  constructor() {
    super("The request body is not acceptable.");
    this.name = "UnacceptableBodyError";
  }
}
