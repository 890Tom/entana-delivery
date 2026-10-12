import { createInterface } from "node:readline";
import { Writable } from "node:stream";

export interface HiddenPrompt {
  ask(question: string): Promise<string>;
  close(): void;
}

/**
 * Reads lines from `input` without echoing them: readline writes to a stream that discards
 * everything, and only the question goes to `output`. One interface serves every question, so no
 * typed character is lost between two of them.
 */
export function createHiddenPrompt(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): HiddenPrompt {
  const discard = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const lines = createInterface({ input, output: discard, terminal: true });
  return {
    ask: (question) =>
      new Promise((resolve, reject) => {
        output.write(question);
        lines.once("line", (line) => {
          output.write("\n");
          resolve(line);
        });
        lines.once("close", () => {
          reject(new Error("The input was closed before a line was typed."));
        });
      }),
    close: () => {
      lines.close();
    },
  };
}
