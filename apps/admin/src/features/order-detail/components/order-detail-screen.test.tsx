import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { formatAmount } from "../../../order-display/format-order";
import { expectNoAccessibilityViolations } from "../../../test-support/assertions/expect-no-accessibility-violations";
import {
  buildDetail,
  NOW,
  openOrderDetail,
  openOrderPage,
  ORDER_ID,
} from "../../../test-support/order-detail/detail-harness";
import {
  detailRoute,
  jsonResponse,
  networkFailure,
  problemResponse,
} from "../../../test-support/stubs/stub-api";

// The library needs WebGL: the adapter that names it is the external boundary.
const mapLoader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../map/maplibre-adapter", () => ({ loadReadonlyMap: mapLoader.load }));

const t = texts.orderDetail;

/** Testing Library reads the text with its spaces normalised, the no-break one included. */
const plain = (text: string): string => text.replace(/\s/g, " ");

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

const serve = (order = buildDetail()): Parameters<typeof openOrderDetail>[0] => ({
  [detailRoute(order.id)]: () => jsonResponse(order),
});

describe("the sheet", () => {
  it("shows the articles, the totals, the customer, the landmark and the history", async () => {
    await openOrderDetail(serve());

    expect(screen.getByText(t.receivedToday("9 h 47"))).toBeTruthy();
    const lines = screen.getByRole("region", { name: t.lines.title });
    expect(within(lines).getByText("Vanille")).toBeTruthy();
    expect(within(lines).getByText(plain(t.lines.unitPrice(formatAmount(1000))))).toBeTruthy();
    expect(within(lines).getByText(t.lines.quantity(2))).toBeTruthy();
    expect(within(lines).getByText(t.lines.subtotal(2)).parentElement?.textContent).toContain(
      formatAmount(2000),
    );
    expect(within(lines).getByText(t.lines.delivery).parentElement?.textContent).toContain(
      formatAmount(2500),
    );
    expect(within(lines).getByText(t.lines.total).parentElement?.textContent).toContain(
      formatAmount(4500),
    );
    const customer = screen.getByRole("region", { name: t.customer.title });
    expect(within(customer).getByText("Rasoa")).toBeTruthy();
    // The number is written in the national form once the country code of the shop is known.
    expect(await within(customer).findByText("033 12 345 67")).toBeTruthy();
    const address = screen.getByRole("region", { name: t.address.title });
    expect(
      within(address).getByText(t.address.landmark("Maison jaune, en face de l'épicerie")),
    ).toBeTruthy();
    const history = screen.getByRole("region", { name: t.history.title });
    expect(within(history).getByText("9 h 47")).toBeTruthy();
    expect(within(history).getByText(t.history.received)).toBeTruthy();
    expect(within(history).getByText(t.history.byCustomer)).toBeTruthy();
  });

  it("shows the zone in the address card and names its place on the delivery fee", async () => {
    await openOrderDetail(
      serve(buildDetail({ deliveryZone: { placeName: "Analakely", axisName: "Axe nord" } })),
    );

    const address = screen.getByRole("region", { name: t.address.title });
    expect(within(address).getByText("Analakely")).toBeTruthy();
    expect(within(address).getByText("Axe nord")).toBeTruthy();
    const lines = screen.getByRole("region", { name: t.lines.title });
    expect(
      within(lines).getByText(t.lines.deliveryTo("Analakely")).parentElement?.textContent,
    ).toContain(formatAmount(2500));
  });

  it("says the order is outside an axis, and names no place on the fee, when it has no zone", async () => {
    await openOrderDetail(serve());

    const address = screen.getByRole("region", { name: t.address.title });
    expect(within(address).getByText(t.address.outsideAxis)).toBeTruthy();
    const lines = screen.getByRole("region", { name: t.lines.title });
    expect(within(lines).getByText(t.lines.delivery)).toBeTruthy();
  });

  it("says when the order was received yesterday, and on which day before that", async () => {
    await openOrderDetail(serve(buildDetail({ createdAt: "2026-09-30T06:47:00.000Z" })));
    expect(screen.getByText(t.receivedYesterday("9 h 47"))).toBeTruthy();
    cleanup();

    await openOrderDetail(serve(buildDetail({ createdAt: "2026-09-28T06:47:00.000Z" })));
    expect(screen.getByText(t.receivedOn("28 sept.", "9 h 47"))).toBeTruthy();
  });

  it("answers that the order is unknown, with a way back to the list", async () => {
    openOrderPage({ [detailRoute("unknown")]: () => problemResponse(404) }, "unknown");

    await screen.findByText(t.notFound);

    const back = within(screen.getByRole("main")).getByRole("link", { name: t.back });
    expect(back.getAttribute("href")).toBe("/commandes");
    expect(screen.queryByRole("region", { name: t.lines.title })).toBeNull();
  });

  it("offers to try again when the order cannot be loaded", async () => {
    openOrderPage({ [detailRoute(ORDER_ID)]: () => networkFailure() });

    await screen.findByText(t.loadFailed);

    expect(screen.getByRole("button", { name: texts.common.retry })).toBeTruthy();
  });

  it("calls the customer with a tel: link in the international form", async () => {
    await openOrderDetail(serve());

    const call = await screen.findByRole("link", {
      name: t.customer.callLabel("Rasoa", "033 12 345 67"),
    });

    expect(call.getAttribute("href")).toBe("tel:+261331234567");
  });

  it("draws the delivery point on a map made from the style of the shop", async () => {
    await openOrderDetail(serve());

    await waitFor(() => {
      expect(mapLoader.load).toHaveBeenCalledWith(
        expect.objectContaining({
          styleUrl: "https://tiles.openfreemap.org/styles/liberty",
          point: { lat: -18.9, lng: 47.5 },
        }),
      );
    });
  });

  it("says the map could not be loaded, and loads it again on request", async () => {
    mapLoader.load.mockRejectedValueOnce(new Error("no WebGL"));
    await openOrderDetail(serve());

    await screen.findByText(t.address.mapFailed);
    fireEvent.click(
      within(screen.getByRole("group", { name: t.address.mapLabel })).getByRole("button", {
        name: texts.common.retry,
      }),
    );

    await waitFor(() => {
      expect(mapLoader.load).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText(t.address.mapFailed)).toBeNull();
  });

  it("reads the order again when the tab gets the focus back", async () => {
    const api = await openOrderDetail(serve());
    const readsBefore = api.calls(detailRoute(ORDER_ID)).length;

    act(() => {
      window.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(api.calls(detailRoute(ORDER_ID)).length).toBeGreaterThan(readsBefore);
    });
  });

  it("has no accessibility violation", async () => {
    await openOrderDetail(serve());

    await expectNoAccessibilityViolations(document.body);
  });
});
