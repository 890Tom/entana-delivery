import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { resetOrderSubmission } from "../../test-support/order-submission/reset-order-submission";
import { TOKEN, openTracking, viewAnswer } from "../../test-support/harnesses/tracking-harness";

const STORED = [{ code: "AAAAAA", token: TOKEN }];
const PHONE = "+261341234567";
const { actions } = texts.tracking;

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("calling the delivery", () => {
  it("is a telephone link with the number of the shop while the order goes on", async () => {
    openTracking({ stored: STORED, instance: { contactPhone: PHONE } });

    const link = await screen.findByRole("link", { name: actions.call });

    expect(link.getAttribute("href")).toBe(`tel:${PHONE}`);
  });

  it("is absent when the shop has no number, and takes no room", async () => {
    openTracking({ stored: STORED, instance: { contactPhone: null } });

    await screen.findByRole("button", { name: actions.cancel });

    expect(screen.queryByRole("link", { name: actions.call })).toBeNull();
  });

  it("is absent once the order is finished, which offers to order again", async () => {
    openTracking({
      stored: STORED,
      instance: { contactPhone: PHONE },
      tracking: viewAnswer({ status: "DELIVERED", canCancel: false, deliveryDate: "2026-10-02" }),
    });

    const reorder = await screen.findByRole("link", { name: actions.reorder });

    expect(reorder.getAttribute("href")).toBe("/");
    expect(screen.queryByRole("link", { name: actions.call })).toBeNull();
    expect(screen.queryByRole("button", { name: actions.cancel })).toBeNull();
  });
});
