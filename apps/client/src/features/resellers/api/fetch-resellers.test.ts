import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, problemResponse, stubFetch } from "../../../test-support/stubs/stub-fetch";

import { fetchResellers, readResellersErrorKind } from "./fetch-resellers";

const RESELLER = {
  id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  name: "Demo Reseller",
  neighborhood: "Demo Area",
  landmark: "Next to the fake market",
  latitude: -18.9,
  longitude: 47.5,
};

async function readFailureKind(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return readResellersErrorKind(error);
  }
  return "no failure";
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchResellers", () => {
  it("returns the validated list from a plain GET of the public address", async () => {
    const stub = stubFetch(() => Promise.resolve(jsonResponse({ resellers: [RESELLER] })));

    const response = await fetchResellers();

    expect(response).toStrictEqual({ resellers: [RESELLER] });
    expect(stub.mock.calls[0]?.[0]).toBe("/api/v1/resellers");
  });

  it("refuses a body that is not the contract", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ resellers: [{ ...RESELLER, visible: true }] })));

    expect(await readFailureKind(fetchResellers())).toBe("unexpected");
  });

  it("tells a server failure from a network one", async () => {
    stubFetch(() => Promise.resolve(problemResponse(500)));
    expect(await readFailureKind(fetchResellers())).toBe("server");

    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await readFailureKind(fetchResellers())).toBe("network");
  });
});
