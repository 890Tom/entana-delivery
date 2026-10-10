import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app";
import { createQueryClient } from "../../data-fetching/query-client";
import { texts } from "../../i18n/texts";
import {
  INSTANCE,
  TAPPED,
  TAPPED_ROUNDED,
  locateButton,
  placeButton,
  readyMap,
  renderAt,
  renderDelivery,
  seedCart,
  stubApi,
} from "../../test-support/delivery-harness";
import { expectNoAccessibilityViolations } from "../../test-support/expect-no-accessibility-violations";
import { createFakeMapLoader } from "../../test-support/fake-map";
import { restoreGeolocation, stubGeolocation } from "../../test-support/stub-geolocation";

import { MAP_LOADER_CONTEXT } from "./map/map-loader-context";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

beforeEach(() => {
  localStorage.clear();
  document.title = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  restoreGeolocation();
});

describe("the delivery screen", () => {
  it("has its heading, its document title and the focus on the main area when reached from the cart", async () => {
    stubApi();
    seedCart();
    renderAt("/panier", createFakeMapLoader());

    fireEvent.click(await screen.findByRole("link", { name: texts.cart.screen.continue }));

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(
      texts.delivery.heading,
    );
    expect(screen.queryByText(texts.notFound.title)).toBeNull();
    await waitFor(() => {
      expect(document.title).toBe(`${texts.delivery.title} — ${INSTANCE.name}`);
    });
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("goes back to the cart, replacing the history entry, when the cart is empty", async () => {
    stubApi();
    window.history.pushState({}, "", "/livraison");
    const historyLength = window.history.length;

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MAP_LOADER_CONTEXT value={createFakeMapLoader().loader}>
          <App />
        </MAP_LOADER_CONTEXT>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/panier");
    });
    expect(window.history.length).toBe(historyLength);
  });

  it("names the step in the header and offers the way back to the cart", async () => {
    await renderDelivery(createFakeMapLoader());

    const banner = screen.getByRole("banner");
    expect(
      within(banner).getByRole("link", { name: texts.shell.backToCart }).getAttribute("href"),
    ).toBe("/panier");
    expect(within(banner).getByText(texts.shell.steps.address)).toBeTruthy();
  });

  it("asks for the map of the instance configuration", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);

    const options = fake.loader.mock.calls[0]?.[0];
    expect(options?.styleUrl).toBe("https://style.example/custom");
    expect(options?.center).toEqual({ lat: -18.8, lng: 47.4 });
    expect(options?.zoom).toBe(13);
  });

  it("shows the placed point rounded to 6 decimals and announces it", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);

    act(() => {
      map.pick(TAPPED);
    });

    expect(map.markers.at(-1)).toEqual(TAPPED_ROUNDED);
    expect(screen.getByRole("status").textContent).toBe(texts.delivery.placed);
  });

  it("refuses a point outside the bounds of the contract", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);

    act(() => {
      map.pick({ lat: 91, lng: 47.5 });
    });

    expect(map.markers.filter((marker) => marker !== null)).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("places the point at the centre of the map with the button, which the keyboard can reach", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);
    map.center = TAPPED;

    expect(placeButton().tagName).toBe("BUTTON");
    expect(placeButton().getAttribute("tabindex")).toBeNull();
    fireEvent.click(placeButton());

    expect(map.markers.at(-1)).toEqual(TAPPED_ROUNDED);
    expect(screen.getByRole("status").textContent).toBe(texts.delivery.placed);
  });

  it("does not place a point with the button while the map is loading", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);

    expect(placeButton().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(placeButton());
    const map = await readyMap(fake);

    expect(map.markers.filter((marker) => marker !== null)).toHaveLength(0);
  });

  it("removes the map when the user leaves the screen", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);

    fireEvent.click(screen.getByRole("link", { name: texts.shell.backToCart }));

    await waitFor(() => {
      expect(map.isDestroyed).toBe(true);
    });
  });

  it("never writes a coordinate to the console, the address, the page or the network", async () => {
    const consoleCalls = CONSOLE_METHODS.map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const geolocation = stubGeolocation();
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);

    act(() => {
      map.pick(TAPPED);
    });
    fireEvent.click(locateButton());
    act(() => {
      geolocation.succeed(TAPPED.lat, TAPPED.lng);
    });
    await waitFor(() => {
      expect(map.centrings).toHaveLength(1);
    });

    const everythingWritten = JSON.stringify([
      consoleCalls.map((spy) => spy.mock.calls),
      window.location.href,
      document.body.textContent,
      vi.mocked(fetch).mock.calls,
    ]);
    expect(everythingWritten).not.toMatch(/18\.9|47\.5/);
    // The only request is the instance configuration: the map is the one external call, and
    // it is made by the library, never by the application.
    expect(vi.mocked(fetch).mock.calls.map((call) => call[0])).toEqual(["/api/v1/instance"]);
  });

  it("has no accessibility violation, with the map as a named group", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    await readyMap(fake);

    expect(screen.getByRole("group", { name: texts.delivery.map.label })).toBeTruthy();
    await expectNoAccessibilityViolations(document.body);
  });
});
