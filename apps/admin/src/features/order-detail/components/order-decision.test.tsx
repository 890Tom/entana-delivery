import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
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
  problemResponse,
  transitionRoute,
} from "../../../test-support/stubs/stub-api";

const mapLoader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../map/maplibre-adapter", () => ({ loadReadonlyMap: mapLoader.load }));

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

const serve = (order = buildDetail()): Parameters<typeof openOrderDetail>[0] => ({
  [detailRoute(order.id)]: () => jsonResponse(order),
});
const button = (name: string): HTMLElement => screen.getByRole("button", { name });
const isDisabled = (element: HTMLElement): boolean =>
  element.getAttribute("aria-disabled") === "true";

describe("the day of a new order", () => {
  it("selects no day, disables the button, and counts the quick days in the zone of the shop", async () => {
    await openOrderDetail(serve());

    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => (radio as HTMLInputElement).checked)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(isDisabled(button(d.confirmIdle))).toBe(true);
    expect(screen.getByRole("radio", { name: /Aujourd'hui.*jeu\. 1 oct\./ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Demain.*ven\. 2 oct\./ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Après-demain.*sam\. 3 oct\./ })).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: new RegExp(`${d.otherDate}.*${d.calendar}`) }),
    ).toBeTruthy();
    expect(screen.getByText(d.informed)).toBeTruthy();
  });

  it("follows the chosen day in the label of the button", async () => {
    await openOrderDetail(serve());

    fireEvent.click(screen.getByRole("radio", { name: /Après-demain/ }));
    expect(isDisabled(button(d.confirmFor("sam. 3 octobre")))).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: /Demain/ }));
    expect(button(d.confirmFor("ven. 2 octobre"))).toBeTruthy();
  });

  it("refuses a day outside the window of 60 days, and takes one inside it", async () => {
    await openOrderDetail(serve());
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(d.otherDate) }));
    const picker = screen.getByLabelText(d.pickDay);
    expect(picker.getAttribute("min")).toBe("2026-10-01");
    expect(picker.getAttribute("max")).toBe("2026-11-30");

    fireEvent.change(picker, { target: { value: "2026-12-25" } });
    expect(screen.getByText(d.invalidDay)).toBeTruthy();
    expect(isDisabled(button(d.confirmIdle))).toBe(true);

    fireEvent.change(picker, { target: { value: "2026-10-20" } });
    expect(screen.queryByText(d.invalidDay)).toBeNull();
    expect(isDisabled(button(d.confirmFor("mar. 20 octobre")))).toBe(false);
  });
});

describe("confirming", () => {
  it("sends the chosen day, then shows the order as confirmed", async () => {
    const confirmed = buildDetail({ status: "CONFIRMED", deliveryDate: "2026-10-03" });
    const api = await openOrderDetail({
      ...serve(),
      [transitionRoute(ORDER_ID)]: () => jsonResponse(confirmed),
    });
    api.answer(detailRoute(ORDER_ID), () => jsonResponse(confirmed));
    fireEvent.click(screen.getByRole("radio", { name: /Après-demain/ }));

    fireEvent.click(button(d.confirmFor("sam. 3 octobre")));

    await screen.findByText(d.plannedFor("sam. 3 octobre"));
    expect(sentBody(api.calls(transitionRoute(ORDER_ID))[0])).toEqual({
      to: "CONFIRMED",
      deliveryDate: "2026-10-03",
    });
    expect(button(d.startDelivery)).toBeTruthy();
  });

  it("disables the buttons while the change is being sent", async () => {
    let release: (response: Response) => void = () => undefined;
    await openOrderDetail({
      ...serve(),
      [transitionRoute(ORDER_ID)]: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    fireEvent.click(screen.getByRole("radio", { name: /Demain/ }));

    fireEvent.click(button(d.confirmFor("ven. 2 octobre")));

    await waitFor(() => {
      expect(isDisabled(button(d.reject))).toBe(true);
    });
    await act(async () => {
      release(jsonResponse(buildDetail({ status: "CONFIRMED", deliveryDate: "2026-10-02" })));
      await Promise.resolve();
    });
  });

  it("says the status changed, and reads the order again, on a 409", async () => {
    const api = await openOrderDetail({
      ...serve(),
      [transitionRoute(ORDER_ID)]: () => problemResponse(409),
    });
    const readsBefore = api.calls(detailRoute(ORDER_ID)).length;
    api.answer(detailRoute(ORDER_ID), () =>
      jsonResponse(buildDetail({ status: "CONFIRMED", deliveryDate: "2026-10-02" })),
    );
    fireEvent.click(screen.getByRole("radio", { name: /Demain/ }));

    fireEvent.click(button(d.confirmFor("ven. 2 octobre")));

    await screen.findByText(t.conflict);
    await screen.findByText(d.plannedFor("ven. 2 octobre"));
    expect(api.calls(detailRoute(ORDER_ID)).length).toBeGreaterThan(readsBefore);
  });

  it("gives a generic message for any other failure, and never a word of the server", async () => {
    await openOrderDetail({
      ...serve(),
      [transitionRoute(ORDER_ID)]: () => problemResponse(500),
    });
    fireEvent.click(screen.getByRole("radio", { name: /Demain/ }));

    fireEvent.click(button(d.confirmFor("ven. 2 octobre")));

    await screen.findByText(texts.orders.actionFailed);
    expect(document.body.textContent).not.toContain("SECRET");
  });
});
