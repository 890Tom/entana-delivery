import { afterEach, describe, expect, it, vi } from "vitest";

import { isLaunchHandled, markLaunchHandled } from "./launch-flag";

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("the launch flag", () => {
  it("is set by marking, and holds nothing but a mark", () => {
    expect(isLaunchHandled()).toBe(false);

    markLaunchHandled();

    expect(isLaunchHandled()).toBe(true);
    expect(sessionStorage).toHaveLength(1);
    expect(sessionStorage.getItem("entana.launch-handled.v1")).toBe("1");
  });

  it("counts as handled when the storage cannot be read, so that nobody is sent away again", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(isLaunchHandled()).toBe(true);
  });

  it("does not throw when the storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(() => {
      markLaunchHandled();
    }).not.toThrow();
  });
});
