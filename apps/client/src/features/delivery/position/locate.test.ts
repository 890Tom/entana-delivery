import { afterEach, describe, expect, it } from "vitest";

import { restoreGeolocation, stubGeolocation } from "../../../test-support/stub-geolocation";

import { locate } from "./locate";

afterEach(restoreGeolocation);

describe("locate", () => {
  it("gives the position of the device, rounded to 6 decimals", async () => {
    const geolocation = stubGeolocation();

    const result = locate();
    geolocation.succeed(-18.9123456789, 47.5123454);

    expect(await result).toEqual({
      status: "found",
      point: { lat: -18.912346, lng: 47.512345 },
    });
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ] as const)("tells why the position is missing (code %i)", async (code, reason) => {
    const geolocation = stubGeolocation();

    const result = locate();
    geolocation.fail(code);

    expect(await result).toEqual({ status: "failed", reason });
  });

  it("is unavailable when the browser has no geolocation", async () => {
    expect(await locate()).toEqual({ status: "failed", reason: "unavailable" });
  });

  it("never reuses an older position and gives up after a time limit", () => {
    const geolocation = stubGeolocation();

    void locate();

    const options = geolocation.getCurrentPosition.mock.calls[0]?.[2];
    expect(options?.maximumAge).toBe(0);
    expect(options?.timeout).toBeGreaterThan(0);
  });

  it("is unavailable when the device gives a position outside the earth", async () => {
    const geolocation = stubGeolocation();

    const result = locate();
    geolocation.succeed(120, 0);

    expect(await result).toEqual({ status: "failed", reason: "unavailable" });
  });
});
