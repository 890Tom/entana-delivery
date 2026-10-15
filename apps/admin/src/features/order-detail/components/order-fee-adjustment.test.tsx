import { PRODUCT_PRICE_MAX_AR } from "@entana/contracts";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { formatAmount } from "../../../order-display/format-order";
import {
  buildDetail,
  NOW,
  openOrderDetail,
  ORDER_ID,
  sentBody,
} from "../../../test-support/order-detail/detail-harness";
import {
  detailRoute,
  jsonResponse,
  namedProblemResponse,
  transitionRoute,
} from "../../../test-support/stubs/stub-api";
import { showPriceInput } from "../../catalogue/rules/product-form";

const mapLoader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../map/maplibre-adapter", () => ({ loadReadonlyMap: mapLoader.load }));

const t = texts.orderDetail;
const d = t.decision;
const TOMORROW_LABEL = d.confirmFor("ven. 2 octobre");

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

const serve = (): Parameters<typeof openOrderDetail>[0] => ({
  [detailRoute(ORDER_ID)]: () => jsonResponse(buildDetail()),
});
const asRead = (text: string): string => text.replaceAll("\u00a0", " ");
const feeField = (): HTMLInputElement => screen.getByLabelText<HTMLInputElement>(d.feeLabel);
const typeFee = (text: string): void => {
  fireEvent.change(feeField(), { target: { value: text } });
};
const isConfirmDisabled = (): boolean =>
  screen.getByRole("button", { name: TOMORROW_LABEL }).getAttribute("aria-disabled") === "true";
const pickTomorrow = (): void => {
  fireEvent.click(screen.getByRole("radio", { name: /Demain/ }));
};

describe("the delivery fee of a new order", () => {
  it("is filled with the current fee of the order, with a note on its reach", async () => {
    await openOrderDetail(serve());

    expect(feeField().value).toBe(showPriceInput("2500"));
    expect(screen.getByText(d.feeHint)).toBeTruthy();
  });

  it.each([
    ["an empty field", ""],
    ["an amount above the highest one", String(PRODUCT_PRICE_MAX_AR + 1)],
  ])("blocks the confirmation with a message for %s", async (_case, text) => {
    await openOrderDetail(serve());
    pickTomorrow();

    typeFee(text);

    expect(screen.getByText(asRead(d.feeInvalid))).toBeTruthy();
    expect(isConfirmDisabled()).toBe(true);
  });

  it("keeps only the digits of a negative or decimal amount", async () => {
    await openOrderDetail(serve());

    typeFee("-1,5");

    expect(feeField().value).toBe("15");
  });
});

describe("confirming with an adjusted fee", () => {
  it("sends the amount typed", async () => {
    const confirmed = buildDetail({ status: "CONFIRMED", deliveryDate: "2026-10-02" });
    const api = await openOrderDetail({
      ...serve(),
      [transitionRoute(ORDER_ID)]: () => jsonResponse(confirmed),
    });
    api.answer(detailRoute(ORDER_ID), () => jsonResponse(confirmed));
    pickTomorrow();
    typeFee("1000");

    fireEvent.click(screen.getByRole("button", { name: TOMORROW_LABEL }));

    await screen.findByText(d.plannedFor("ven. 2 octobre"));
    expect(sentBody(api.calls(transitionRoute(ORDER_ID))[0])).toEqual({
      to: "CONFIRMED",
      deliveryDate: "2026-10-02",
      deliveryFeeAr: 1000,
    });
  });

  it("shows the fee and the total that the server answered", async () => {
    const confirmed = buildDetail({
      status: "CONFIRMED",
      deliveryDate: "2026-10-02",
      deliveryFeeAr: 1500,
      totalAr: 3500,
    });
    const api = await openOrderDetail({
      ...serve(),
      [transitionRoute(ORDER_ID)]: () => jsonResponse(confirmed),
    });
    api.answer(detailRoute(ORDER_ID), () => jsonResponse(confirmed));
    pickTomorrow();
    typeFee("1000");

    fireEvent.click(screen.getByRole("button", { name: TOMORROW_LABEL }));

    await screen.findByText(d.plannedFor("ven. 2 octobre"));
    const lines = within(screen.getByRole("region", { name: t.lines.title }));
    expect(lines.getByText(asRead(formatAmount(1500)))).toBeTruthy();
    expect(lines.getByText(asRead(formatAmount(3500)))).toBeTruthy();
  });

  it("says the total would be too large, and keeps the order to confirm with the amount typed", async () => {
    await openOrderDetail({
      ...serve(),
      [transitionRoute(ORDER_ID)]: () => namedProblemResponse(422, "order_total_too_large"),
    });
    pickTomorrow();
    typeFee("999999");

    fireEvent.click(screen.getByRole("button", { name: TOMORROW_LABEL }));

    await screen.findByText(d.totalTooLarge);
    expect(isConfirmDisabled()).toBe(false);
    expect(feeField().value).toBe(showPriceInput("999999"));
    expect(screen.queryByText(texts.orders.actionFailed)).toBeNull();
  });

  it("drops the message of a total too large as soon as the amount changes", async () => {
    await openOrderDetail({
      ...serve(),
      [transitionRoute(ORDER_ID)]: () => namedProblemResponse(422, "order_total_too_large"),
    });
    pickTomorrow();
    typeFee("999999");
    fireEvent.click(screen.getByRole("button", { name: TOMORROW_LABEL }));
    await screen.findByText(d.totalTooLarge);

    typeFee("99999");

    expect(screen.queryByText(d.totalTooLarge)).toBeNull();
  });

  it("says the total is too large again when a new attempt is refused the same way", async () => {
    await openOrderDetail({
      ...serve(),
      [transitionRoute(ORDER_ID)]: () => namedProblemResponse(422, "order_total_too_large"),
    });
    pickTomorrow();
    typeFee("999999");
    fireEvent.click(screen.getByRole("button", { name: TOMORROW_LABEL }));
    await screen.findByText(d.totalTooLarge);
    typeFee("99999");

    fireEvent.click(screen.getByRole("button", { name: TOMORROW_LABEL }));

    await screen.findByText(d.totalTooLarge);
  });
});
