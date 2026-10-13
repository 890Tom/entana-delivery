import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import {
  CUSTOMER,
  FAR,
  MIDDLE,
  NEAR,
  RESELLERS,
  failingAnswer,
  neighborhoodField,
  nearbyButton,
  openResellers,
  readyMap,
  shownNames,
} from "../../test-support/harnesses/resellers-harness";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import { jsonResponse } from "../../test-support/stubs/stub-fetch";
import { createFakeResellersMapLoader } from "../../test-support/stubs/fake-resellers-map";
import { restoreGeolocation, stubGeolocation } from "../../test-support/stubs/stub-geolocation";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // jsdom does not scroll: the card of a marker asks to be brought into view.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  restoreGeolocation();
});

function readStorage(storage: Storage): (string | null)[] {
  return Object.keys(storage).map((key) => storage.getItem(key));
}

async function showList(): Promise<void> {
  await screen.findByText(texts.resellers.count(RESELLERS.length, false));
}

describe("the resellers screen: the list", () => {
  it("shows the resellers in the order of the API, without a distance", async () => {
    openResellers(createFakeResellersMapLoader());
    await showList();

    expect(shownNames()).toEqual([
      expect.stringContaining(FAR.name),
      expect.stringContaining(NEAR.name),
      expect.stringContaining(MIDDLE.name),
    ]);
    expect(screen.queryByText(/km/)).toBeNull();
  });

  it("says so when there is no point of sale", async () => {
    openResellers(createFakeResellersMapLoader(), () =>
      Promise.resolve(jsonResponse({ resellers: [] })),
    );

    expect(await screen.findByText(texts.resellers.empty.title)).toBeTruthy();
  });

  it("tells a network failure, and asks again with Réessayer", async () => {
    let attempts = 0;
    const app = openResellers(createFakeResellersMapLoader(), () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new TypeError("Failed to fetch"))
        : Promise.resolve(jsonResponse({ resellers: RESELLERS }));
    });

    await screen.findByText(texts.resellers.errors.network);
    fireEvent.click(screen.getByRole("button", { name: texts.common.retry }));

    await showList();
    expect(app.calls().filter(([url]) => url === "/api/v1/resellers")).toHaveLength(2);
  });

  it("shows a skeleton while the list loads", () => {
    openResellers(createFakeResellersMapLoader(), () => new Promise<Response>(() => undefined));

    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("does not answer a server failure with the server's text", async () => {
    openResellers(createFakeResellersMapLoader(), failingAnswer());

    expect(await screen.findByText(texts.resellers.errors.server)).toBeTruthy();
    expect(screen.queryByText(/SECRET/)).toBeNull();
  });
});

describe("the resellers screen: the neighborhood filter", () => {
  it("narrows the list and the markers, ignoring case and accents", async () => {
    const fake = createFakeResellersMapLoader();
    openResellers(fake);
    const map = await readyMap(fake);
    await showList();

    fireEvent.change(neighborhoodField(), { target: { value: "AMPEFILOHA" } });

    expect(shownNames()).toEqual([expect.stringContaining(FAR.name)]);
    expect(screen.getByText(texts.resellers.count(1, false))).toBeTruthy();
    await waitFor(() => {
      expect(map.shops.map((shop) => shop.name)).toEqual([FAR.name]);
    });
  });

  it("says when no neighborhood matches, and shows everything again on request", async () => {
    openResellers(createFakeResellersMapLoader());
    await showList();

    fireEvent.change(neighborhoodField(), { target: { value: "zzz" } });
    expect(screen.getByText(texts.resellers.noMatch.title)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: texts.resellers.noMatch.action }));

    expect(shownNames()).toHaveLength(RESELLERS.length);
    expect(neighborhoodField().value).toBe("");
  });
});

describe("the resellers screen: around me", () => {
  it("does not ask for the position when the page loads", async () => {
    const geolocation = stubGeolocation();
    const fake = createFakeResellersMapLoader();
    openResellers(fake);
    await readyMap(fake);
    await showList();

    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("sorts by distance, shows each distance and centres the map on the customer", async () => {
    const geolocation = stubGeolocation();
    const fake = createFakeResellersMapLoader();
    openResellers(fake);
    const map = await readyMap(fake);
    await showList();

    fireEvent.click(nearbyButton());
    expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce();
    act(() => {
      geolocation.succeed(CUSTOMER.lat, CUSTOMER.lng);
    });

    expect(await screen.findByText(texts.resellers.count(3, true))).toBeTruthy();
    expect(shownNames()).toEqual([
      expect.stringContaining(`${NEAR.name}${NEAR.neighborhood} · 0,6\u00a0km`),
      expect.stringContaining(`${MIDDLE.name}${MIDDLE.neighborhood} · 2,2\u00a0km`),
      expect.stringContaining(`${FAR.name}${FAR.neighborhood} · 5,6\u00a0km`),
    ]);
    await waitFor(() => {
      expect(map.userPosition).toEqual(CUSTOMER);
    });
    expect(map.centrings.at(-1)).toEqual(CUSTOMER);
  });

  it.each([
    [1, texts.resellers.geo.denied],
    [2, texts.resellers.geo.unavailable],
    [3, texts.resellers.geo.timeout],
  ] as const)("keeps the order and says why (code %i)", async (code, message) => {
    const geolocation = stubGeolocation();
    openResellers(createFakeResellersMapLoader());
    await showList();
    const before = shownNames();

    fireEvent.click(nearbyButton());
    act(() => {
      geolocation.fail(code);
    });

    expect(await screen.findByText(message)).toBeTruthy();
    expect(shownNames()).toEqual(before);
    expect(screen.queryByText(/km/)).toBeNull();
  });

  it("keeps the position out of every request, storage and address", async () => {
    const geolocation = stubGeolocation();
    const app = openResellers(createFakeResellersMapLoader());
    await showList();

    fireEvent.click(nearbyButton());
    act(() => {
      geolocation.succeed(CUSTOMER.lat, CUSTOMER.lng);
    });
    await screen.findByText(texts.resellers.count(3, true));

    const everythingSent = JSON.stringify(app.calls());
    expect(everythingSent).not.toContain(String(CUSTOMER.lat));
    expect(everythingSent).not.toContain(String(CUSTOMER.lng));
    const stored = JSON.stringify([readStorage(localStorage), readStorage(sessionStorage)]);
    expect(stored).not.toContain(String(CUSTOMER.lat));
    expect(stored).not.toContain(String(CUSTOMER.lng));
    expect(document.cookie).toBe("");
    expect(window.location.href).not.toContain(String(CUSTOMER.lat));
  });
});

describe("the resellers screen: directions", () => {
  it("opens the directions to the reseller in a new tab, without the opener", async () => {
    openResellers(createFakeResellersMapLoader());
    await showList();

    const link = screen.getByRole("link", { name: texts.resellers.routeLabel(NEAR.name) });

    expect(link.getAttribute("href")).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${String(NEAR.latitude)},${String(NEAR.longitude)}`,
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("the resellers screen: the list and the map together", () => {
  it("centres the map on a reseller chosen in the list and highlights its marker", async () => {
    const fake = createFakeResellersMapLoader();
    openResellers(fake);
    const map = await readyMap(fake);
    await showList();

    const card = screen.getByRole("button", { name: new RegExp(NEAR.name) });
    fireEvent.click(card);

    await waitFor(() => {
      expect(map.selectedId).toBe(NEAR.id);
    });
    expect(map.centrings.at(-1)).toEqual({ lat: NEAR.latitude, lng: NEAR.longitude });
    expect(card.getAttribute("aria-pressed")).toBe("true");
  });

  it("highlights the card of a marker that is activated", async () => {
    const fake = createFakeResellersMapLoader();
    openResellers(fake);
    const map = await readyMap(fake);
    await showList();

    act(() => {
      map.clickMarker(MIDDLE.id);
    });

    const card = screen.getByRole("button", { name: new RegExp(MIDDLE.name) });
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect(within(screen.getByRole("main")).getAllByRole("button", { pressed: true })).toHaveLength(
      1,
    );
  });

  it("tells when the map cannot load, and keeps the list", async () => {
    const fake = createFakeResellersMapLoader();
    openResellers(fake);
    await waitFor(() => {
      expect(fake.loader).toHaveBeenCalled();
    });

    act(() => {
      fake.fail();
    });

    expect(await screen.findByText(texts.resellers.map.failed)).toBeTruthy();
    await showList();
    expect(shownNames()).toHaveLength(RESELLERS.length);
  });

  it("is built from the map settings of the instance", async () => {
    const fake = createFakeResellersMapLoader();
    openResellers(fake);
    const map = await readyMap(fake);

    expect(map.options.styleUrl).toBe("https://style.example/custom");
    expect(map.options.center).toEqual({ lat: -18.8, lng: 47.4 });
    expect(map.options.zoom).toBe(13);
  });
});

describe("the resellers screen: the page", () => {
  it("has one main heading and no accessibility violation", async () => {
    const fake = createFakeResellersMapLoader();
    openResellers(fake);
    await readyMap(fake);
    await showList();

    expect(
      screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent),
    ).toEqual([texts.resellers.title]);
    expect(document.title).toContain(texts.resellers.title);
    await expectNoAccessibilityViolations(document.body);
  });
});
