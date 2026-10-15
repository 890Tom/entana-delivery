import { afterEach, describe, expect, it, vi } from "vitest";

import { buildDeliveryZone } from "../../../test-support/builders/build-delivery-quote";
import { jsonResponse, stubFetch } from "../../../test-support/stubs/stub-fetch";

import { fetchDeliveryZones } from "./fetch-delivery-zones";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDeliveryZones", () => {
  it("returns the validated circles from a plain GET of the public address", async () => {
    const stub = stubFetch(() => Promise.resolve(jsonResponse({ zones: [buildDeliveryZone()] })));

    expect(await fetchDeliveryZones()).toStrictEqual({ zones: [buildDeliveryZone()] });
    expect(stub.mock.calls[0]?.[0]).toBe("/api/v1/delivery/zones");
    expect(stub.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("refuses an answer that is not the contract", async () => {
    stubFetch(() =>
      Promise.resolve(jsonResponse({ zones: [{ ...buildDeliveryZone(), axis: "A" }] })),
    );

    await expect(fetchDeliveryZones()).rejects.toThrow("unexpected");
  });
});
