import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTACT_DRAFT_STORAGE_KEY,
  EMPTY_CONTACT_DRAFT,
  clearStoredContactDraft,
  parseStoredContactDraft,
  readStoredContactDraft,
  serializeContactDraft,
  writeStoredContactDraft,
} from "./contact-draft-storage";

const DRAFT = {
  name: "Rakoto Jean",
  phone: "034 12 345 67",
  note: "Avant 15h.\nSonnez deux fois.",
};

const stored = (value: unknown): string => JSON.stringify(value);
const complete = (overrides: Record<string, unknown>): string =>
  stored({ version: 1, name: "Rakoto", phone: "34 12 345 67", note: null, ...overrides });

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the stored contact draft", () => {
  it("gives back what was written, the texts exactly as typed", () => {
    const draft = { ...DRAFT, name: "  Rakoto Jean  " };

    expect(parseStoredContactDraft(serializeContactDraft(draft))).toEqual(draft);
  });

  it("stores an empty note as nothing, and reads nothing as an empty note", () => {
    const serialized = serializeContactDraft({ ...DRAFT, note: "" });

    expect(JSON.parse(serialized)).toMatchObject({ note: null });
    expect(parseStoredContactDraft(serialized).note).toBe("");
  });

  it("stores a value that the rules refuse as nothing", () => {
    const serialized = serializeContactDraft({ name: "   ", phone: "12ab", note: "a\tb" });

    expect(parseStoredContactDraft(serialized)).toEqual(EMPTY_CONTACT_DRAFT);
  });

  it("is empty when nothing was stored", () => {
    expect(parseStoredContactDraft(null)).toEqual(EMPTY_CONTACT_DRAFT);
  });

  it.each([
    ["not JSON", "{not json"],
    ["not an object", "[1,2]"],
    ["another version", complete({ version: 2 })],
    ["a missing key", stored({ version: 1, name: "Rakoto", phone: "34 12 345 67" })],
    ["an unknown key", complete({ extra: 1 })],
    ["a name that is not a text", complete({ name: 12 })],
    ["a name with a control character", complete({ name: "Rak\u0007oto" })],
    ["a name over the contract length", complete({ name: "a".repeat(81) })],
    ["a note over the contract length", complete({ note: "a".repeat(301) })],
    ["a phone number with a letter", complete({ phone: "34 12 a45" })],
    ["a phone number with a plus sign", complete({ phone: "+261 34 12 345 67" })],
    ["a phone number over 20 characters", complete({ phone: "1".repeat(21) })],
    ["more than 4 KB", complete({ pad: "x".repeat(4100) })],
  ])("is empty when the stored content has %s", (_label, raw) => {
    expect(parseStoredContactDraft(raw)).toEqual(EMPTY_CONTACT_DRAFT);
  });

  it("is read from, written to and removed from the session storage under a versioned key", () => {
    writeStoredContactDraft(DRAFT);

    expect(CONTACT_DRAFT_STORAGE_KEY).toBe("entana.contact.v1");
    expect(sessionStorage.getItem(CONTACT_DRAFT_STORAGE_KEY)).toBe(serializeContactDraft(DRAFT));
    expect(localStorage.getItem(CONTACT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(readStoredContactDraft()).toEqual(DRAFT);

    clearStoredContactDraft();

    expect(sessionStorage.getItem(CONTACT_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("is empty and does not throw when the storage cannot be read, written or cleared", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readStoredContactDraft()).toEqual(EMPTY_CONTACT_DRAFT);
    expect(() => {
      writeStoredContactDraft(DRAFT);
      clearStoredContactDraft();
    }).not.toThrow();
  });
});
