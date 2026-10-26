import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildInstanceTheme } from "../../../test-support/builders/build-instance-theme";

import {
  THEME_STORAGE_ITEM,
  clearStoredTheme,
  readStoredTheme,
  writeStoredTheme,
} from "./instance-theme-storage";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("the stored theme", () => {
  it("is read back as it was written, under a versioned key", () => {
    writeStoredTheme(buildInstanceTheme());

    expect(THEME_STORAGE_ITEM).toBe("entana.theme.v1");
    expect(readStoredTheme()).toEqual(buildInstanceTheme());
  });

  it("is forgotten when it is cleared", () => {
    writeStoredTheme(buildInstanceTheme());
    clearStoredTheme();

    expect(readStoredTheme()).toBeNull();
    expect(localStorage.getItem(THEME_STORAGE_ITEM)).toBeNull();
  });

  it("is absent when nothing was stored", () => {
    expect(readStoredTheme()).toBeNull();
  });

  const withoutAccent = Object.fromEntries(
    Object.entries(buildInstanceTheme()).filter(([key]) => key !== "accent"),
  );

  it.each([
    ["a value that is not a hex colour", JSON.stringify(buildInstanceTheme({ accent: "red" }))],
    ["a colour in injected CSS", JSON.stringify(buildInstanceTheme({ action: "#000; x: y" }))],
    ["a missing key", JSON.stringify(withoutAccent)],
    ["an extra key", JSON.stringify({ ...buildInstanceTheme(), extra: "#000000" })],
    ["a text that is not JSON", "{not json"],
    ["a JSON that is not an object", "[]"],
  ])("is refused, and removed from the storage, with %s", (_label, content) => {
    localStorage.setItem(THEME_STORAGE_ITEM, content);

    expect(readStoredTheme()).toBeNull();
    expect(localStorage.getItem(THEME_STORAGE_ITEM)).toBeNull();
  });
});
