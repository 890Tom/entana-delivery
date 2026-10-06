import { describe, expect, it } from "vitest";
import {
  describeMissingArtifacts,
  findMissingArtifacts,
  readDefaultExportTarget,
} from "./find-missing-artifacts.ts";

const PASSWORD_HASH = {
  label: "the built output of @entana/password-hash",
  path: "/Users/someone/repo/packages/password-hash/dist/index.js",
};
const OTHER = { label: "the built output of @entana/other", path: "/Users/someone/repo/o.js" };

describe("findMissingArtifacts", () => {
  it("returns an empty list when every artifact exists", () => {
    expect(findMissingArtifacts([PASSWORD_HASH, OTHER], () => true)).toEqual([]);
  });

  it("reports the artifact that does not exist, with its label", () => {
    const missing = findMissingArtifacts([PASSWORD_HASH, OTHER], (path) => path === OTHER.path);

    expect(missing).toEqual([PASSWORD_HASH]);
  });

  it("reports several missing artifacts in the order they were given", () => {
    expect(findMissingArtifacts([OTHER, PASSWORD_HASH], () => false)).toEqual([
      OTHER,
      PASSWORD_HASH,
    ]);
  });

  it("asks the predicate about the path of each artifact", () => {
    const asked: string[] = [];

    findMissingArtifacts([PASSWORD_HASH, OTHER], (path) => asked.push(path) > 0);

    expect(asked).toEqual([PASSWORD_HASH.path, OTHER.path]);
  });
});

describe("describeMissingArtifacts", () => {
  it("names what is missing and gives the command to run", () => {
    const message = describeMissingArtifacts([PASSWORD_HASH]);

    expect(message).toContain("the built output of @entana/password-hash");
    expect(message).toContain("pnpm build");
  });

  it("never shows a path of the machine", () => {
    const message = describeMissingArtifacts([PASSWORD_HASH, OTHER]);

    expect(message).not.toContain("/Users/someone");
    expect(message).not.toContain("dist/index.js");
  });

  it("lists the labels in the order given, and is the same each time", () => {
    const message = describeMissingArtifacts([OTHER, PASSWORD_HASH]);

    expect(message.indexOf(OTHER.label)).toBeLessThan(message.indexOf(PASSWORD_HASH.label));
    expect(describeMissingArtifacts([OTHER, PASSWORD_HASH])).toBe(message);
  });

  it("is a short message that ends with a new line", () => {
    const message = describeMissingArtifacts([PASSWORD_HASH]);

    expect(message.endsWith("\n")).toBe(true);
    expect(message.trimEnd().split("\n").length).toBeLessThanOrEqual(3);
  });
});

describe("readDefaultExportTarget", () => {
  it("returns the default target of the root export", () => {
    const manifest = { exports: { ".": { types: "./src/index.ts", default: "./dist/index.js" } } };

    expect(readDefaultExportTarget(manifest)).toBe("./dist/index.js");
  });

  it.each([
    ["not an object", "text"],
    ["no exports", {}],
    ["no root export", { exports: {} }],
    ["no default target", { exports: { ".": { types: "./src/index.ts" } } }],
    ["a default that is not a string", { exports: { ".": { default: 1 } } }],
  ])("returns undefined when the manifest has %s", (_name, manifest) => {
    expect(readDefaultExportTarget(manifest)).toBeUndefined();
  });
});
