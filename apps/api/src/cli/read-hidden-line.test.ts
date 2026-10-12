import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { createHiddenPrompt } from "./read-hidden-line.js";

function collect(stream: PassThrough): () => string {
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  return () => Buffer.concat(chunks).toString("utf8");
}

describe("createHiddenPrompt", () => {
  it("returns what was typed and never writes it back", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const written = collect(output);
    const prompt = createHiddenPrompt(input, output);

    const answer = prompt.ask("Password: ");
    input.write("a-very-private-password\n");

    expect(await answer).toBe("a-very-private-password");
    prompt.close();
    expect(written()).toContain("Password: ");
    expect(written()).not.toContain("a-very-private-password");
  });

  it("asks twice on the same input", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const prompt = createHiddenPrompt(input, output);

    const first = prompt.ask("1: ");
    input.write("one\n");
    expect(await first).toBe("one");
    const second = prompt.ask("2: ");
    input.write("two\n");

    expect(await second).toBe("two");
    prompt.close();
  });

  it("fails when the input ends before a line", async () => {
    const input = new PassThrough();
    const prompt = createHiddenPrompt(input, new PassThrough());

    const answer = prompt.ask("Password: ");
    input.end();

    await expect(answer).rejects.toThrow("closed");
  });
});
