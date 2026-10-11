import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildAttempt } from "../../../test-support/builders/build-order-submission";

import {
  PENDING_ORDER_STORAGE_ITEM,
  clearStoredAttempt,
  readStoredAttempt,
  writeStoredAttempt,
} from "./pending-order-storage";

const stored = (overrides: Record<string, unknown> = {}): string => {
  const attempt = buildAttempt();
  return JSON.stringify({ version: 1, ...attempt, ...overrides });
};

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the stored attempt", () => {
  it("is read back as it was written, under a versioned key in the session storage", () => {
    writeStoredAttempt(buildAttempt());

    expect(PENDING_ORDER_STORAGE_ITEM).toBe("entana.pending-order.v1");
    expect(sessionStorage.getItem(PENDING_ORDER_STORAGE_ITEM)).not.toBeNull();
    expect(localStorage.getItem(PENDING_ORDER_STORAGE_ITEM)).toBeNull();
    expect(readStoredAttempt()).toEqual(buildAttempt());
  });

  it("is forgotten when it is cleared", () => {
    writeStoredAttempt(buildAttempt());
    clearStoredAttempt();

    expect(readStoredAttempt()).toBeNull();
  });

  it.each([
    ["text that is not JSON", "{not json"],
    ["another version", stored({ version: 2 })],
    ["a field that is not expected", stored({ extra: 1 })],
    ["a key that is not a uuid", stored({ key: "abc" })],
    ["a token that is not one", stored({ token: "short" })],
    ["a request the contract refuses", stored({ request: { phone: "1" } })],
    ["a text over the size limit", `${stored()}${" ".repeat(9000)}`],
  ])("is no attempt for %s", (_label, content) => {
    sessionStorage.setItem(PENDING_ORDER_STORAGE_ITEM, content);

    expect(readStoredAttempt()).toBeNull();
  });

  it("does not fail when the storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(readStoredAttempt()).toBeNull();
    expect(writeStoredAttempt(buildAttempt())).toBe(false);
  });
});
