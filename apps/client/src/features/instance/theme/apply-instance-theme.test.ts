import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInstanceTheme } from "../../../test-support/builders/build-instance-theme";

import { applyInstanceTheme, restoreStoredTheme } from "./apply-instance-theme";
import { THEME_STORAGE_ITEM, readStoredTheme, writeStoredTheme } from "./instance-theme-storage";

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

beforeEach(() => {
  localStorage.clear();
  clearVariables();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  clearVariables();
});

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

  it("keeps the theme on the device", () => {
    applyInstanceTheme(buildInstanceTheme());

    expect(readStoredTheme()).toEqual(buildInstanceTheme());
  });

  it("replaces the colours and the stored theme with the ones that arrive", () => {
    applyInstanceTheme(buildInstanceTheme());
    applyInstanceTheme(buildInstanceTheme({ accent: "#d97706", action: "#d97706" }));

    expect(writtenVariables()["--color-accent"]).toBe("#d97706");
    expect(writtenVariables()["--color-surface-inverse"]).toBe("#d97706");
    expect(readStoredTheme()?.accent).toBe("#d97706");
  });

  it("removes the seven variables and forgets the stored theme when there is no theme", () => {
    applyInstanceTheme(buildInstanceTheme());
    applyInstanceTheme(null);

    expect(writtenVariables()).toEqual({});
    expect(localStorage.getItem(THEME_STORAGE_ITEM)).toBeNull();
  });
});

describe("restoreStoredTheme", () => {
  it("applies the theme kept on the device", () => {
    writeStoredTheme(buildInstanceTheme());

    restoreStoredTheme();

    expect(writtenVariables()["--color-accent"]).toBe("#2d6cdf");
    expect(writtenVariables()["--color-text-inverse"]).toBe("#ffffff");
  });

  it("writes nothing when the stored theme is invalid", () => {
    localStorage.setItem(THEME_STORAGE_ITEM, JSON.stringify(buildInstanceTheme({ accent: "red" })));

    restoreStoredTheme();

    expect(writtenVariables()).toEqual({});
  });
});

describe("a storage that throws", () => {
  it("neither breaks the application nor the theme, which stays applied in memory", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => {
      restoreStoredTheme();
      applyInstanceTheme(buildInstanceTheme());
    }).not.toThrow();
    expect(writtenVariables()["--color-accent"]).toBe("#2d6cdf");
    expect(() => {
      applyInstanceTheme(null);
    }).not.toThrow();
    expect(writtenVariables()).toEqual({});
  });
});
