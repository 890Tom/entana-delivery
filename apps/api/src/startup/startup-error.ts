/**
 * A startup failure whose message is complete, in French, and safe to print as it is: it names a
 * variable or keys, never a value or a path. The entry point prints it without any stack.
 */
export class StartupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StartupError";
  }
}
