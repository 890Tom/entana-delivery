import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  NAME,
  NOTE,
  PHONE,
  continueButtons,
  fillValidContact,
  nameField,
  noteField,
  openContact,
  phoneField,
  reopenContact,
  typeInto,
} from "../../../test-support/contact-harness";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the contact draft", () => {
  it("comes back after a reload, the phone number as it was typed", async () => {
    openContact();
    typeInto(await nameField(), NAME);
    typeInto(await phoneField(), PHONE);
    typeInto(await noteField(), NOTE);
    fireEvent.click((await continueButtons()).bar);
    await waitFor(() => {
      expect(window.location.pathname).toBe("/recapitulatif");
    });

    reopenContact();

    expect((await nameField()).value).toBe(NAME);
    expect((await phoneField()).value).toBe(PHONE);
    expect((await noteField()).value).toBe(NOTE);
  });

  it.each([
    ["not JSON", "{not json"],
    ["another version", JSON.stringify({ version: 2, name: NAME, phone: PHONE, note: null })],
    [
      "more than 4 KB",
      JSON.stringify({ version: 1, name: NAME, phone: PHONE, note: null, p: "x".repeat(5000) }),
    ],
  ])("starts empty, without an error, when what was stored is %s", async (_label, contactDraft) => {
    openContact({ contactDraft });

    expect((await nameField()).value).toBe("");
    expect((await phoneField()).value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("goes on working in memory when the storage cannot be written", async () => {
    openContact();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await fillValidContact();

    fireEvent.click((await continueButtons()).bar);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/recapitulatif");
    });
  });
});
