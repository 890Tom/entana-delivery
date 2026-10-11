import { afterEach, describe, expect, it, vi } from "vitest";

import { buildInstance } from "../../../test-support/builders/build-instance";
import { jsonResponse, problemResponse, stubFetch } from "../../../test-support/stubs/stub-fetch";

import { InstanceError, fetchInstance } from "./fetch-instance";

async function readFailureKind(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error instanceof InstanceError ? error.kind : error;
  }
  return "no failure";
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchInstance", () => {
  it("returns the validated instance and sends a plain GET without credentials", async () => {
    const instance = buildInstance({ logoUrl: "/media/branding/logo.png" });
    const stub = stubFetch(() => Promise.resolve(jsonResponse(instance)));

    const response = await fetchInstance();

    const [url, init] = stub.mock.calls[0] ?? [];
    expect(response).toStrictEqual(instance);
    expect(url).toBe("/api/v1/instance");
    expect(init?.method).toBe("GET");
    expect(init?.credentials).toBe("omit");
  });

  it("refuses a logo address outside the branding folder (unexpected)", async () => {
    const instance = buildInstance({ logoUrl: "https://elsewhere.example/logo.png" });
    stubFetch(() => Promise.resolve(jsonResponse(instance)));

    expect(await readFailureKind(fetchInstance())).toBe("unexpected");
  });

  it("refuses a 200 with an extra property (unexpected)", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ ...buildInstance(), secret: "x" })));

    expect(await readFailureKind(fetchInstance())).toBe("unexpected");
  });

  it("reports a 500 as a server error", async () => {
    stubFetch(() => Promise.resolve(problemResponse(500)));

    expect(await readFailureKind(fetchInstance())).toBe("server");
  });

  it("reports a network failure", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));

    expect(await readFailureKind(fetchInstance())).toBe("network");
  });
});
