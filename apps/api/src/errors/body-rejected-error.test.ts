import { describe, expect, it, vi } from "vitest";
import { BodyRejectedError, rejectBody } from "./body-rejected-error.js";

function run(error: unknown): unknown {
  const next = vi.fn<(error?: unknown) => void>();
  rejectBody(error, undefined, undefined, next);
  expect(next).toHaveBeenCalledOnce();
  return next.mock.calls[0]?.[0];
}

describe("rejectBody", () => {
  it("replaces a parser error by one that has only its status", () => {
    const parserError = Object.assign(new SyntaxError('Unexpected token "secret-field"'), {
      status: 400,
    });

    const result = run(parserError);

    expect(result).toBeInstanceOf(BodyRejectedError);
    expect(result).toMatchObject({ status: 400 });
    expect(String(result)).not.toContain("secret-field");
  });

  it("passes an error that is not a client error on unchanged", () => {
    const error = new Error("something else");
    expect(run(error)).toBe(error);
  });
});
