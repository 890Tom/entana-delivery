import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AddressRateLimiter } from "../../src/orders/address-rate-limiter.js";
import { ADDRESS_MAX_REQUESTS, ADDRESS_MAX_TRACKED } from "../../src/orders/order-http-limits.js";
import { startOrdersApp } from "./support/start-orders-app.js";
import { buildTestConfig } from "./support/test-config.js";

describe("the limiter that the application module creates", () => {
  let app: NestExpressApplication;
  let limiter: AddressRateLimiter;

  beforeAll(async () => {
    app = await startOrdersApp(buildTestConfig());
    limiter = app.get(AddressRateLimiter);
  });
  afterAll(async () => {
    await app.close();
  });

  // Runs the real middleware of the instantiated limiter. True when the request was let through.
  function passes(address: string): boolean {
    const next = vi.fn();
    const request = { method: "POST", path: "/", ip: address, headers: {} } as unknown as Request;
    limiter.middleware(request, { setHeader: vi.fn() } as never, next);
    return next.mock.calls[0]?.length === 0;
  }

  it("limits an address after the production number of requests", () => {
    const results = Array.from({ length: ADDRESS_MAX_REQUESTS + 1 }, () => passes("198.51.100.1"));

    expect(results.filter(Boolean)).toHaveLength(ADDRESS_MAX_REQUESTS);
    expect(results[ADDRESS_MAX_REQUESTS]).toBe(false);
  });

  it("never tracks more addresses than the production cap, and keeps a limited address limited", () => {
    for (let count = 0; count <= ADDRESS_MAX_REQUESTS; count += 1) {
      passes("198.51.100.77");
    }
    expect(passes("198.51.100.77")).toBe(false);
    for (let index = 0; index < ADDRESS_MAX_TRACKED + 2500; index += 1) {
      passes(`10.${String(index >> 16)}.${String((index >> 8) & 255)}.${String(index & 255)}`);
    }

    expect(limiter.trackedAddresses).toBe(ADDRESS_MAX_TRACKED);
    expect(passes("198.51.100.77")).toBe(false);
  });
});
