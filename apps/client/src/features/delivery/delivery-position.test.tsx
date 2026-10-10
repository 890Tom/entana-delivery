import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import {
  TAPPED,
  TAPPED_ROUNDED,
  locateButton,
  readyMap,
  renderDelivery,
} from "../../test-support/delivery-harness";
import { createFakeMapLoader } from "../../test-support/fake-map";
import { restoreGeolocation, stubGeolocation } from "../../test-support/stub-geolocation";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  restoreGeolocation();
});

describe("the position of the device on the delivery screen", () => {
  it("is asked for only when the user asks", async () => {
    const geolocation = stubGeolocation();
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    await readyMap(fake);

    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(locateButton());

    expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce();
  });

  it("places the point of the device and centres the map on it at a close zoom", async () => {
    const geolocation = stubGeolocation();
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);

    fireEvent.click(locateButton());
    act(() => {
      geolocation.succeed(TAPPED.lat, TAPPED.lng);
    });

    await waitFor(() => {
      expect(map.markers.at(-1)).toEqual(TAPPED_ROUNDED);
    });
    expect(map.centrings).toEqual([{ point: TAPPED_ROUNDED, zoom: 16 }]);
  });

  it("is remembered while the map is loading, and shown when the map is ready", async () => {
    const geolocation = stubGeolocation();
    const fake = createFakeMapLoader();
    await renderDelivery(fake);

    expect(locateButton().getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(locateButton());
    act(() => {
      geolocation.succeed(TAPPED.lat, TAPPED.lng);
    });
    const map = await readyMap(fake);

    await waitFor(() => {
      expect(map.markers.at(-1)).toEqual(TAPPED_ROUNDED);
    });
  });

  it("is ignored when the user placed the point by hand while it was awaited", async () => {
    const geolocation = stubGeolocation();
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);
    fireEvent.click(locateButton());

    act(() => {
      map.pick({ lat: -18.9, lng: 47.5 });
    });
    act(() => {
      geolocation.succeed(TAPPED.lat, TAPPED.lng);
    });

    await waitFor(() => {
      expect(locateButton().getAttribute("aria-disabled")).toBeNull();
    });
    expect(map.markers.at(-1)).toEqual({ lat: -18.9, lng: 47.5 });
    expect(map.centrings).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("is ignored without a message when it fails after the user placed the point by hand", async () => {
    const geolocation = stubGeolocation();
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);
    fireEvent.click(locateButton());

    act(() => {
      map.pick({ lat: -18.9, lng: 47.5 });
    });
    act(() => {
      geolocation.fail(1);
    });

    await waitFor(() => {
      expect(locateButton().getAttribute("aria-disabled")).toBeNull();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    [1, texts.delivery.geo.denied],
    [2, texts.delivery.geo.unavailable],
    [3, texts.delivery.geo.timeout],
  ] as const)("says what to do when it fails (code %i)", async (code, message) => {
    const geolocation = stubGeolocation();
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);

    fireEvent.click(locateButton());
    act(() => {
      geolocation.fail(code);
    });

    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(map.markers.filter((marker) => marker !== null)).toHaveLength(0);
  });

  it("clears its message once a point is placed", async () => {
    const geolocation = stubGeolocation();
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);
    fireEvent.click(locateButton());
    act(() => {
      geolocation.fail(1);
    });
    await screen.findByRole("alert");

    act(() => {
      map.pick(TAPPED);
    });

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("a map that cannot be loaded on the delivery screen", () => {
  it("shows a notice with a retry, and keeps the position available", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);

    act(() => {
      fake.fail();
    });

    expect((await screen.findByRole("alert")).textContent).toContain(texts.delivery.map.failed);
    expect(locateButton().getAttribute("aria-disabled")).toBeNull();
  });

  it("is loaded again on retry, and keeps the point obtained meanwhile", async () => {
    const geolocation = stubGeolocation();
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    act(() => {
      fake.fail();
    });
    fireEvent.click(await screen.findByRole("button", { name: texts.common.retry }));
    fireEvent.click(locateButton());
    act(() => {
      geolocation.succeed(TAPPED.lat, TAPPED.lng);
    });

    await waitFor(() => {
      expect(fake.loader).toHaveBeenCalledTimes(2);
    });
    const map = await readyMap(fake);

    await waitFor(() => {
      expect(map.markers.at(-1)).toEqual(TAPPED_ROUNDED);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
