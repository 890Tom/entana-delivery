import { describe, expect, it } from "vitest";
import { describeDatabaseTarget } from "./environment.ts";

describe("describeDatabaseTarget", () => {
  it("shows host and port, never the credentials", () => {
    const text = describeDatabaseTarget("postgresql://entana:s3cret@localhost:5433/entana");
    expect(text).toBe("localhost:5433");
    expect(text).not.toContain("s3cret");
  });

  it("shows the host alone without a port", () => {
    expect(describeDatabaseTarget("postgresql://entana@postgres/entana")).toBe("postgres");
  });

  it.each([
    ["a password with an unescaped slash", "postgresql://entana:pa/ss#word@localhost/entana"],
    ["not a URL", "not a url"],
    ["an empty host", "postgresql:///entana"],
    ["an empty string", ""],
  ])("gives a fixed text for %s, without the input", (_label, url) => {
    const text = describeDatabaseTarget(url);
    expect(text).toBe("the configured database");
  });
});
