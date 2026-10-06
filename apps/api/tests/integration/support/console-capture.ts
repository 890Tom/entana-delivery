import { format } from "node:util";
import { vi } from "vitest";

export interface ConsoleCapture {
  /** Restores the console and the streams, and returns everything written meanwhile. */
  stop(): string[];
}

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

/**
 * Records what the application writes outside its logger (a stray console.log, a direct write to
 * the streams): the pino destination of the suite would never see it. Started before a request
 * and stopped after it, so that the test runner's own output is never captured.
 */
export function startConsoleCapture(): ConsoleCapture {
  const lines: string[] = [];
  const record = (...args: unknown[]): void => {
    lines.push(format(...args));
  };
  const spies = [
    ...CONSOLE_METHODS.map((method) => vi.spyOn(console, method).mockImplementation(record)),
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      lines.push(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      lines.push(String(chunk));
      return true;
    }),
  ];
  return {
    stop: () => {
      spies.forEach((spy) => {
        spy.mockRestore();
      });
      return lines;
    },
  };
}
