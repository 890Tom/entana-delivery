import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DELIVERY_DRAFT_STORAGE_KEY,
  clearStoredDraft,
  EMPTY_DRAFT,
  parseStoredDraft,
  readStoredDraft,
  serializeDraft,
  writeStoredDraft,
} from "./delivery-draft-storage";

const DRAFT = { point: { lat: -18.912346, lng: 47.512346 }, landmark: "Portail bleu" };

const stored = (value: unknown): string => JSON.stringify(value);

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the stored delivery draft", () => {
  it("gives back what was written, the landmark exactly as typed", () => {
    const draft = { ...DRAFT, landmark: "  Portail bleu  " };

    expect(parseStoredDraft(serializeDraft(draft))).toEqual(draft);
  });

  it("stores a landmark that the contract refuses as nothing, and keeps the point", () => {
    const parsed = parseStoredDraft(serializeDraft({ ...DRAFT, landmark: "   " }));

    expect(parsed).toEqual({ point: DRAFT.point, landmark: "" });
  });

  it("is empty when nothing was stored", () => {
    expect(parseStoredDraft(null)).toEqual(EMPTY_DRAFT);
  });

  it.each([
    ["not JSON", "{not json"],
    ["not an object", "[1,2]"],
    ["another version", stored({ version: 2, point: null, landmark: null })],
    ["a missing key", stored({ version: 1, point: null })],
    ["an unknown key", stored({ version: 1, point: null, landmark: null, extra: 1 })],
    [
      "a latitude outside the bounds",
      stored({ version: 1, point: { lat: 91, lng: 47 }, landmark: null }),
    ],
    [
      "a longitude that is not a number",
      stored({ version: 1, point: { lat: -18, lng: "47" }, landmark: null }),
    ],
    [
      "a point with an extra key",
      stored({ version: 1, point: { lat: -18, lng: 47, z: 1 }, landmark: null }),
    ],
    [
      "a landmark with a control character",
      stored({ version: 1, point: null, landmark: "a\u0007bc" }),
    ],
    [
      "a landmark over the contract length",
      stored({ version: 1, point: null, landmark: "a".repeat(201) }),
    ],
    [
      "more than 2 KB",
      stored({ version: 1, point: null, landmark: "a".repeat(200), pad: "x".repeat(2100) }),
    ],
  ])("is empty when the stored content has %s", (_label, raw) => {
    expect(parseStoredDraft(raw)).toEqual(EMPTY_DRAFT);
  });

  it("is read from and written to the session storage under a versioned key", () => {
    writeStoredDraft(DRAFT);

    expect(DELIVERY_DRAFT_STORAGE_KEY).toBe("entana.delivery.v1");
    expect(sessionStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY)).toBe(serializeDraft(DRAFT));
    expect(localStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY)).toBeNull();
    expect(readStoredDraft()).toEqual(DRAFT);
  });

  it("is removed from the session storage when cleared, and clearing never throws", () => {
    writeStoredDraft(DRAFT);

    clearStoredDraft();

    expect(sessionStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY)).toBeNull();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => {
      clearStoredDraft();
    }).not.toThrow();
  });

  it("is empty and does not throw when the storage cannot be read or written", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readStoredDraft()).toEqual(EMPTY_DRAFT);
    expect(() => {
      writeStoredDraft(DRAFT);
    }).not.toThrow();
  });
});
