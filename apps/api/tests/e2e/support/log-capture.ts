import { Writable } from "node:stream";

export interface LogCapture {
  readonly stream: Writable;
  /** Every line written so far, parsed (the application writes one JSON object per line). */
  entries(): Record<string, unknown>[];
  /** The raw text written so far, to prove that something was never logged. */
  text(): string;
  /** Forgets what was written, so that a test only sees its own logs. */
  reset(): void;
}

export function captureLogs(): LogCapture {
  let chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done): void {
      chunks.push(chunk.toString());
      done();
    },
  });
  return {
    stream,
    text: () => chunks.join(""),
    reset: () => {
      chunks = [];
    },
    entries: () =>
      chunks
        .join("")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line): Record<string, unknown> => {
          const parsed: unknown = JSON.parse(line);
          return typeof parsed === "object" && parsed !== null ? { ...parsed } : {};
        }),
  };
}
