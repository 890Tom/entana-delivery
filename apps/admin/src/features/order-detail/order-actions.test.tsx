import { MAX_STATUS_REASON_LENGTH } from "@entana/contracts";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import {
  buildDetail,
  NOW,
  openOrderDetail,
  ORDER_CODE,
  ORDER_ID,
  sentBody,
} from "../../test-support/order-detail/detail-harness";
import type { ApiStub } from "../../test-support/stubs/stub-api";
import { detailRoute, jsonResponse, transitionRoute } from "../../test-support/stubs/stub-api";

const mapLoader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./map/maplibre-adapter", () => ({ loadReadonlyMap: mapLoader.load }));

const t = texts.orderDetail;
const d = t.decision;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mapLoader.load.mockReset();
  mapLoader.load.mockResolvedValue({ destroy: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Order = Parameters<typeof buildDetail>[0];

/** An order in `overrides`; once a transition is sent, the API answers with `after` from then on. */
function open(overrides: Order, after: Order = { status: "REJECTED" }): Promise<ApiStub> {
  let current = buildDetail(overrides);
  return openOrderDetail({
    [detailRoute(ORDER_ID)]: () => jsonResponse(current),
    [transitionRoute(ORDER_ID)]: () => {
      current = buildDetail({ ...overrides, ...after });
      return jsonResponse(current);
    },
  });
}

const sentTransitions = (api: ApiStub): unknown[] =>
  api.calls(transitionRoute(ORDER_ID)).map((call) => sentBody(call));

async function openRefusal(): Promise<ApiStub> {
  const api = await open({});
  fireEvent.click(screen.getByRole("button", { name: d.reject }));
  await screen.findByRole("dialog", { name: t.dialog.rejectTitle(ORDER_CODE) });
  return api;
}

describe("the refusal", () => {
  it("opens a modal with an optional reason and the help text", async () => {
    await openRefusal();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(t.dialog.reasonHelp)).toBeTruthy();
    expect(within(dialog).getByLabelText(t.dialog.reasonLabel)).toBeTruthy();
    await expectNoAccessibilityViolations(document.body);
  });

  it("leaves the reason out of the request when nothing was typed", async () => {
    const api = await openRefusal();

    fireEvent.click(screen.getByRole("button", { name: t.dialog.rejectConfirm }));

    await waitFor(() => {
      expect(sentTransitions(api)).toEqual([{ to: "REJECTED" }]);
    });
  });

  it("sends the typed reason", async () => {
    const api = await openRefusal();

    fireEvent.change(screen.getByLabelText(t.dialog.reasonLabel), {
      target: { value: "Rupture de stock" },
    });
    fireEvent.click(screen.getByRole("button", { name: t.dialog.rejectConfirm }));

    await waitFor(() => {
      expect(sentTransitions(api)).toEqual([{ to: "REJECTED", reason: "Rupture de stock" }]);
    });
  });

  it("blocks the sending of a reason that is too long", async () => {
    const api = await openRefusal();

    fireEvent.change(screen.getByLabelText(t.dialog.reasonLabel), {
      target: { value: "a".repeat(MAX_STATUS_REASON_LENGTH + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: t.dialog.rejectConfirm }));

    expect(screen.getByText(t.dialog.reasonTooLong(MAX_STATUS_REASON_LENGTH))).toBeTruthy();
    expect(sentTransitions(api)).toEqual([]);
  });

  it("closes on Escape and gives the focus back to the button that opened it", async () => {
    await openRefusal();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: d.reject }));
  });

  it("keeps the focus inside the modal when Tab goes past its last control", async () => {
    await openRefusal();
    const dialog = screen.getByRole("dialog");
    const last = within(dialog).getByRole("button", { name: t.dialog.rejectConfirm });
    last.focus();

    fireEvent.keyDown(last, { key: "Tab" });

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(last);
  });

  it("keeps the focus inside the modal when Shift+Tab goes back past its first control", async () => {
    await openRefusal();
    const dialog = screen.getByRole("dialog");
    const first = within(dialog).getByLabelText(t.dialog.reasonLabel);
    first.focus();

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: t.dialog.rejectConfirm }),
    );
  });

  it("closes the modal and shows the reason when the order was refused", async () => {
    await open({}, { status: "REJECTED", rejectionReason: "Rupture de stock" });
    fireEvent.click(screen.getByRole("button", { name: d.reject }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: t.dialog.rejectConfirm }));

    await screen.findByText(d.reason("Rupture de stock"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the actions follow the status", () => {
  it("offers the delivery and the refusal for a confirmed order, and sends the delivery", async () => {
    const api = await open(
      { status: "CONFIRMED", deliveryDate: "2026-10-03" },
      { status: "OUT_FOR_DELIVERY" },
    );
    expect(screen.getByText(d.plannedFor("sam. 3 octobre"))).toBeTruthy();
    expect(screen.getByRole("button", { name: d.reject })).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: d.startDelivery }));

    await waitFor(() => {
      expect(sentTransitions(api)).toEqual([{ to: "OUT_FOR_DELIVERY" }]);
    });
  });

  it("offers Livrée and a failed delivery for an order on the road, and sends FAILED with no reason", async () => {
    const api = await open(
      { status: "OUT_FOR_DELIVERY", deliveryDate: "2026-10-03" },
      { status: "FAILED" },
    );
    expect(screen.getByRole("button", { name: d.markDelivered })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: d.failDelivery }));
    const dialog = await screen.findByRole("dialog", { name: t.dialog.failTitle(ORDER_CODE) });
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: t.dialog.failConfirm }));

    await waitFor(() => {
      expect(sentTransitions(api)).toEqual([{ to: "FAILED" }]);
    });
  });

  it.each([
    ["DELIVERED", "Livrée"],
    ["REJECTED", "Refusée"],
    ["CANCELLED", "Annulée"],
    ["FAILED", "Échec"],
  ] as const)("offers no action for a %s order, and shows its status", async (status, label) => {
    await open({ status, deliveryDate: "2026-10-03" });

    const decision = screen.getByRole("region", { name: d.title });
    expect(within(decision).queryByRole("button")).toBeNull();
    expect(within(decision).getByText(d.status(label))).toBeTruthy();
  });

  it("gives the day of a delivered order, and of a refused one that had been confirmed", async () => {
    await open({ status: "DELIVERED", deliveryDate: "2026-10-03" });
    expect(screen.getByText(d.deliveredOn("sam. 3 octobre"))).toBeTruthy();
    cleanup();

    await open({ status: "REJECTED", deliveryDate: "2026-10-03", rejectionReason: "Hors zone" });
    expect(screen.getByText(d.deliveryDay("sam. 3 octobre"))).toBeTruthy();
  });

  it("gives the reason of a refusal, and no reason line for a cancellation", async () => {
    await open({ status: "REJECTED", rejectionReason: "Hors zone" });
    expect(screen.getByText(d.reason("Hors zone"))).toBeTruthy();
    cleanup();

    await open({ status: "CANCELLED", rejectionReason: null });
    expect(screen.queryByText(/Motif :/)).toBeNull();
  });
});
