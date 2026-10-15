import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import {
  buildDeliveryQuote,
  buildDeliveryZone,
} from "../../test-support/builders/build-delivery-quote";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import {
  TAPPED,
  TAPPED_ROUNDED,
  continueButtons,
  landmarkField,
  readyMap,
  renderDelivery,
  waitForQuote,
} from "../../test-support/harnesses/delivery-harness";
import { createFakeMapLoader } from "../../test-support/stubs/fake-map";
import {
  jsonResponse,
  pendingUntilAborted,
  problemResponse,
} from "../../test-support/stubs/stub-fetch";

const QUOTE_ADDRESS = "/api/v1/delivery/quote";
const SECOND = { lat: -18.95, lng: 47.55 };

type Calls = ReturnType<typeof vi.fn>["mock"]["calls"];

const quoteCalls = (stub: ReturnType<typeof vi.fn>): Calls =>
  stub.mock.calls.filter((call) => call[0] === QUOTE_ADDRESS);

function initOf(call: Calls[number] | undefined): RequestInit | undefined {
  const init: unknown = call?.[1];
  return typeof init === "object" && init !== null ? init : undefined;
}

const isInactive = (button: HTMLElement): boolean =>
  button.getAttribute("aria-disabled") === "true";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
});

describe("the zones of the delivery map", () => {
  it("draws one circle for each zone received", async () => {
    const zones = [
      buildDeliveryZone(),
      buildDeliveryZone({
        id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c",
        latitude: -18.95,
        radiusM: 500,
      }),
    ];
    const fake = createFakeMapLoader();
    await renderDelivery(fake, { zones: () => Promise.resolve(jsonResponse({ zones })) });
    const map = await readyMap(fake);

    await waitFor(() => {
      expect(map.zoneDrawings.at(-1)).toEqual([
        { center: { lat: -18.9, lng: 47.52 }, radiusM: 800 },
        { center: { lat: -18.95, lng: 47.52 }, radiusM: 500 },
      ]);
    });
  });

  it("leaves the screen usable, with no circle and no message, when the zones fail", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake, { zones: () => Promise.resolve(problemResponse(500)) });
    const map = await readyMap(fake);

    act(() => {
      map.pick(TAPPED);
    });
    await waitForQuote();

    expect(map.zoneDrawings.every((zones) => zones.length === 0)).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the delivery quote", () => {
  it("asks for the point and the pieces of the cart 300 ms after the last move", async () => {
    const fake = createFakeMapLoader();
    const fetchStub = await renderDelivery(fake);
    const map = await readyMap(fake);
    vi.useFakeTimers();

    act(() => {
      map.pick(SECOND);
    });
    act(() => {
      map.pick(TAPPED);
    });
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(quoteCalls(fetchStub)).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(quoteCalls(fetchStub)).toHaveLength(1);
    expect(initOf(quoteCalls(fetchStub)[0])?.body).toBe(
      JSON.stringify({ latitude: TAPPED_ROUNDED.lat, longitude: TAPPED_ROUNDED.lng, pieces: 1 }),
    );
  });

  it("shows only the answer for the last point, and cancels the older request", async () => {
    let requestCount = 0;
    const fake = createFakeMapLoader();
    // The first request never answers unless it is cancelled; the second one answers at once.
    const fetchStub = await renderDelivery(fake, {
      quote: (init) => {
        requestCount += 1;
        return requestCount === 1
          ? pendingUntilAborted(init)
          : Promise.resolve(jsonResponse(buildDeliveryQuote({ placeName: "Second Démo" })));
      },
    });
    const map = await readyMap(fake);

    act(() => {
      map.pick(TAPPED);
    });
    await waitFor(() => {
      expect(quoteCalls(fetchStub)).toHaveLength(1);
    });
    act(() => {
      map.pick(SECOND);
    });
    await waitForQuote();

    expect(document.body.textContent).toContain(texts.delivery.fee.zone("Second Démo"));
    expect(initOf(quoteCalls(fetchStub)[0])?.signal?.aborted).toBe(true);
  });

  it("says when the fee cannot be computed, keeps Continuer inactive, and retries", async () => {
    let isFailing = true;
    const fake = createFakeMapLoader();
    await renderDelivery(fake, {
      quote: () =>
        Promise.resolve(isFailing ? problemResponse(500) : jsonResponse(buildDeliveryQuote())),
    });
    const map = await readyMap(fake);
    act(() => {
      map.pick(TAPPED);
    });
    fireEvent.change(landmarkField(), { target: { value: "Portail bleu" } });

    const retry = await screen.findByRole("button", { name: texts.common.retry });
    expect(screen.getByText(texts.delivery.fee.failed)).toBeTruthy();
    expect(isInactive(continueButtons().bar)).toBe(true);
    fireEvent.click(continueButtons().card);
    expect(window.location.pathname).toBe("/livraison");

    isFailing = false;
    fireEvent.click(retry);

    await waitForQuote();
    expect(screen.queryByText(texts.delivery.fee.failed)).toBeNull();
  });

  it("keeps Continuer inactive while the fee is computed, and active once it is known", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);

    act(() => {
      map.pick(TAPPED);
    });

    const { bar, card } = continueButtons();
    expect([isInactive(bar), isInactive(card)]).toEqual([true, true]);
    expect(bar.getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector('[aria-live="polite"] [aria-busy="true"]')).not.toBeNull();
    await waitForQuote();
    expect(isInactive(continueButtons().bar)).toBe(false);
  });

  it("shows no notice of a dropped product when none was dropped", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    await readyMap(fake);

    expect(screen.queryByText(texts.cart.removedUnavailable)).toBeNull();
  });

  it("announces the fee politely, and has no accessibility violation once it is shown", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);
    act(() => {
      map.pick(TAPPED);
    });
    await waitForQuote();

    const region = screen.getByRole("main").querySelector('[aria-live="polite"]');
    expect(region?.textContent).toContain(texts.delivery.fee.free);
    await expectNoAccessibilityViolations(document.body);
  });
});
