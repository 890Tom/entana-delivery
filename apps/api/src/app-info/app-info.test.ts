import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readAppInfo } from "./app-info.js";

describe("readAppInfo", () => {
  it("reads the name and the version of the package", () => {
    const manifest: unknown = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    );
    expect(manifest).toMatchObject(readAppInfo());
    expect(readAppInfo().name).toBe("@entana/api");
    expect(readAppInfo().version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
