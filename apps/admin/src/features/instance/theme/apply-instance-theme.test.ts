import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildInstanceTheme } from "../../../test-support/builders/build-instance-theme";

import { applyInstanceTheme } from "./apply-instance-theme";

const VARIABLES = [
  "--color-accent",
  "--color-accent-soft",
  "--color-accent-strong",
  "--color-text-on-accent",
  "--color-surface-inverse",
  "--color-ink-hover",
  "--color-text-inverse",
] as const;

function writtenVariables(): Record<string, string> {
  const written: Record<string, string> = {};
  for (const name of VARIABLES) {
    const value = document.documentElement.style.getPropertyValue(name);
    if (value !== "") {
      written[name] = value;
    }
  }
  return written;
}

function clearVariables(): void {
  for (const name of VARIABLES) {
    document.documentElement.style.removeProperty(name);
  }
}

beforeEach(clearVariables);
afterEach(clearVariables);

describe("applyInstanceTheme", () => {
  it("writes the seven colours as the roles of the design on the document", () => {
    applyInstanceTheme(buildInstanceTheme());

    expect(writtenVariables()).toEqual({
      "--color-accent": "#2d6cdf",
      "--color-accent-soft": "#e0e9fa",
      "--color-accent-strong": "#2961c9",
      "--color-text-on-accent": "#ffffff",
      "--color-surface-inverse": "#2b2b2b",
      "--color-ink-hover": "#555555",
      "--color-text-inverse": "#ffffff",
    });
  });

  it("removes the seven variables when there is no theme", () => {
    applyInstanceTheme(buildInstanceTheme());
    applyInstanceTheme(null);

    expect(writtenVariables()).toEqual({});
  });

  it("writes nothing for a theme that is not made of hex colours", () => {
    applyInstanceTheme(buildInstanceTheme({ accent: "red" }));
    applyInstanceTheme({ accent: "#000; x: y" });

    expect(writtenVariables()).toEqual({});
  });
});
