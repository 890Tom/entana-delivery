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
  continueButtons,
  landmarkField,
  locateButton,
  placeButton,
  readyMap,
  renderAt,
  renderDelivery,
  seedCart,
  stubApi,
  waitForQuote,
} from "../../test-support/harnesses/delivery-harness";
import { continueButtons as contactContinueButtons } from "../../test-support/harnesses/contact-harness";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import { createFakeMapLoader } from "../../test-support/stubs/fake-map";
import { restoreGeolocation, stubGeolocation } from "../../test-support/stubs/stub-geolocation";

import { MAP_LOADER_CONTEXT } from "./map/map-loader-context";

const QUOTE_ADDRESS = "/api/v1/delivery/quote";
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

    // Two links of this name on a wide window (the bar, and the one that replaces it): the first.
    const links = await screen.findAllByRole("link", { name: texts.cart.screen.continue });
    fireEvent.click(links[0] ?? screen.getByRole("link"));

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

  it("shows the step indicator of every screen, on the second step", async () => {
    await renderDelivery(createFakeMapLoader());

    const steps = screen.getByRole("navigation", { name: texts.shell.steps.label });

    expect(within(steps).getByText(texts.shell.steps.position(2, 5))).toBeTruthy();
    expect(steps.querySelector('[aria-current="step"]')?.textContent).toContain(
      texts.shell.steps.address,
    );
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
    expect(screen.getByRole("status", { name: "" }).textContent).toBe(texts.delivery.placed);
  });

  it("refuses a point outside the bounds of the contract", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);

    act(() => {
      map.pick({ lat: 91, lng: 47.5 });
    });

    expect(map.markers.filter((marker) => marker !== null)).toHaveLength(0);
    expect(screen.getByRole("status", { name: "" }).textContent).toBe("");
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
    expect(screen.getByRole("status", { name: "" }).textContent).toBe(texts.delivery.placed);
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

  it("never writes a coordinate or a landmark to the console, the address or the network", async () => {
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
    fireEvent.change(landmarkField(), { target: { value: "Portail secret du voisin" } });
    await waitForQuote();
    fireEvent.click(continueButtons().card);
    await waitFor(() => {
      expect(window.location.pathname).toBe("/coordonnees");
    });

    // The contact screen that follows: the name, the phone number and the note are personal too.
    fireEvent.change(await screen.findByRole("textbox", { name: texts.contact.name.label }), {
      target: { value: "Rakoto Secret" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: texts.contact.phone.label }), {
      target: { value: "034 98 765 43" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: new RegExp(`^${texts.contact.note.label}`) }),
      {
        target: { value: "Chien méchant" },
      },
    );
    fireEvent.click((await contactContinueButtons()).bar);
    await waitFor(() => {
      expect(window.location.pathname).toBe("/recapitulatif");
    });

    // Not the page text: the review that follows shows these texts to their owner, by design
    // (the review's own test checks that nothing else carries them). The point goes in one place
    // only, the body of the quote, which is left out here and checked below.
    const calls = vi.mocked(fetch).mock.calls;
    const isQuote = (call: (typeof calls)[number]): boolean => call[0] === QUOTE_ADDRESS;
    const everythingWritten = JSON.stringify([
      consoleCalls.map((spy) => spy.mock.calls),
      window.location.href,
      calls.map((call) => (isQuote(call) ? [call[0], { ...call[1], body: undefined }] : call)),
    ]);
    expect(everythingWritten).not.toMatch(
      /18\.9|47\.5|Portail secret|Rakoto Secret|98 765 43|349876543|Chien méchant/,
    );
    // The point and the pieces, as numbers in the body of a POST: nothing else of the customer.
    expect(calls.filter(isQuote).map((call) => [call[1]?.method, call[1]?.body])).toContainEqual([
      "POST",
      JSON.stringify({ latitude: TAPPED_ROUNDED.lat, longitude: TAPPED_ROUNDED.lng, pieces: 1 }),
    ]);
    // The requests of the app: the map is the one external call, made by the library.
    expect(new Set(calls.map((call) => call[0]))).toEqual(
      new Set(["/api/v1/instance", "/api/v1/products", "/api/v1/delivery/zones", QUOTE_ADDRESS]),
    );
  });

  it("has no accessibility violation, with the map as a named group", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    await readyMap(fake);

    expect(screen.getByRole("group", { name: texts.delivery.map.label })).toBeTruthy();
    await expectNoAccessibilityViolations(document.body);
  });
});
