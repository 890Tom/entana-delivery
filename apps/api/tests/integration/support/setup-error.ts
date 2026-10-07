/** A failure whose text is ours: the only kind of error the setup lets through as it is. */
export class SetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupError";
  }
}
