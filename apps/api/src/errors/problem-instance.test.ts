import { describe, expect, it } from "vitest";
import { FALLBACK_INSTANCE, toProblemInstance } from "./problem-instance.js";

describe("toProblemInstance", () => {
  it.each([
    ["/api/v1/health", "/api/v1/health"],
    ["/api/v1/items/ab-c_d.e~f", "/api/v1/items/ab-c_d.e~f"],
    ["/a%20b%2Fc", "/a%20b%2Fc"],
    ["/api/v1/x?q=FAKE-QUERY-8841", "/api/v1/x"],
    ["/api/v1/x#FAKE-FRAGMENT", "/api/v1/x"],
    ["/api/v1/x?a=1#b", "/api/v1/x"],
    ["/FAKE-PATH-8841", "/FAKE-PATH-8841"],
  ])("keeps the path of %s without query or fragment", (url, instance) => {
    expect(toProblemInstance(url)).toBe(instance);
  });

  it.each([
    ["a newline", "/a\nb"],
    ["an encoded newline kept as %0A", "/a%0"],
    ["a malformed percent sequence", "/a%zz"],
    ["a lone percent", "/a%"],
    ["a space", "/a b"],
    ["a right-to-left override", "/a‮b"],
    ["a non-ASCII letter", "/café"],
    ["a colon (absolute-form target)", "http://host/x"],
    ["a backslash", "/a\\b"],
    ["an angle bracket", "/<script>"],
    ["an empty path", ""],
    ["a protocol-relative start", "//host/x"],
    ["three slashes", "///"],
    ["no leading slash", "abc"],
    ["a dot", "."],
    ["only a query", "?q=1"],
  ])("gives the fixed value for %s", (_name, url) => {
    expect(toProblemInstance(url)).toBe(FALLBACK_INSTANCE);
  });

  it("accepts a well-formed encoded newline (it is plain text once encoded)", () => {
    expect(toProblemInstance("/a%0Ab")).toBe("/a%0Ab");
  });

  describe("at the 200 character limit", () => {
    it("keeps a path of exactly 200 characters whole", () => {
      const path = `/${"a".repeat(199)}`;
      expect(path).toHaveLength(200);
      expect(toProblemInstance(path)).toBe(path);
    });

    it("truncates a path of 201 characters to 200", () => {
      const path = `/${"a".repeat(200)}`;
      expect(path).toHaveLength(201);
      expect(toProblemInstance(path)).toBe(path.slice(0, 200));
    });

    it("cuts before the percent sign when the 200th character is inside a %XX of a 201 character path", () => {
      const path = `/${"a".repeat(197)}%41`;
      expect(path).toHaveLength(201);
      expect(toProblemInstance(path)).toBe(`/${"a".repeat(197)}`);
    });
  });

  it("truncates to 200 characters", () => {
    expect(toProblemInstance(`/${"a".repeat(10_000)}`)).toBe(`/${"a".repeat(199)}`);
  });

  // The input is "/", the letters, then "%41": 196 letters make the sequence end at 200.
  it.each([
    ["ends exactly at the limit", 196, `/${"a".repeat(196)}%41`],
    ["has its last digit past the limit", 197, `/${"a".repeat(197)}`],
    ["has only its percent sign before the limit", 198, `/${"a".repeat(198)}`],
  ])("a percent sequence that %s", (_name, letters, expected) => {
    expect(toProblemInstance(`/${"a".repeat(letters)}%41${"b".repeat(50)}`)).toBe(expected);
  });

  it("cuts before a percent sequence that would end past the limit", () => {
    expect(toProblemInstance(`/${"a".repeat(198)}%41`)).toBe(`/${"a".repeat(198)}`);
  });
});
