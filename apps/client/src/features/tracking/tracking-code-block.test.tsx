import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { resetOrderSubmission } from "../../test-support/reset-order-submission";
import { TOKEN, openTracking, storedOrders } from "../../test-support/tracking-harness";

const STORED = [{ code: "AAAAAA", token: TOKEN }];
const { code, link } = texts.tracking;

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "share");
  window.history.replaceState({}, "", "/");
});

describe("the code of the order", () => {
  it("is shown with its explanation and a way to copy it when nothing can share", async () => {
    openTracking({ stored: STORED });

    expect(await screen.findByText("K7M2QX")).toBeTruthy();
    expect(screen.getByText(code.explanation)).toBeTruthy();
    expect(screen.queryByRole("button", { name: code.share })).toBeNull();
    expect(screen.getByRole("button", { name: code.copy })).toBeTruthy();
  });

  it("is shared as a sentence with the shop's name and the code, never the link", async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    openTracking({ stored: STORED });

    fireEvent.click(await screen.findByRole("button", { name: code.share }));

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith({ text: "Ma commande chez Maison Démo : code K7M2QX." });
    });
    expect(screen.queryByRole("button", { name: code.copy })).toBeNull();
  });
});

describe("the link and the order of this device", () => {
  it("copies the address of the order, announces it, and never writes the token in the page", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    openTracking({ stored: STORED });

    fireEvent.click(await screen.findByRole("button", { name: link.copy }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/suivi#${TOKEN}`);
    });
    expect(await screen.findByText(texts.tracking.feedback.linkCopied)).toBeTruthy();
    expect(document.body.innerHTML).not.toContain(TOKEN);
  });

  it("says when the copy is refused", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true,
    });
    openTracking({ stored: STORED });

    fireEvent.click(await screen.findByRole("button", { name: link.copy }));

    expect(await screen.findByText(texts.tracking.feedback.copyFailed)).toBeTruthy();
  });

  it("forgets the order of this device and leads to the catalogue", async () => {
    openTracking({ stored: STORED });

    fireEvent.click(await screen.findByRole("button", { name: link.forget }));

    expect(storedOrders()).toEqual([]);
    expect(window.location.pathname).toBe("/");
  });
});
