import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InvalidMediaRootError, resolveMediaRoot } from "./resolve-media-root.js";

let directory: string;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "entana-root-"));
  writeFileSync(join(directory, "file"), "x");
});
afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

function messageOf(action: () => unknown): string {
  try {
    action();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(InvalidMediaRootError);
    return (error as Error).message;
  }
  throw new Error("expected a failure");
}

describe("resolveMediaRoot", () => {
  it("uses the given folder in production when it exists", () => {
    expect(resolveMediaRoot({ nodeEnv: "production", path: directory })).toBe(directory);
  });

  it.each([
    ["is missing", undefined],
    ["is relative", "media"],
    ["does not exist", "/definitely/not/here"],
  ])("names MEDIA_ROOT in production when it %s", (_label, path) => {
    expect(messageOf(() => resolveMediaRoot({ nodeEnv: "production", path }))).toContain(
      "MEDIA_ROOT",
    );
  });

  it("names MEDIA_ROOT in production when it is a file, without its path", () => {
    const path = join(directory, "file");

    const message = messageOf(() => resolveMediaRoot({ nodeEnv: "production", path }));

    expect(message).toContain("MEDIA_ROOT");
    expect(message).not.toContain(directory);
  });

  it("falls back to a local folder outside production", () => {
    expect(resolveMediaRoot({ nodeEnv: "development", path: undefined })).toMatch(/\/media$/);
  });
});
