import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AddressRateLimitedError } from "../../src/rate-limit/address-rate-limited-error.js";
import {
  OrderNotCancellableError,
  TrackingNotFoundError,
} from "../../src/tracking/errors/tracking-errors.js";
import { buildObservedDatabaseError } from "../support/observed-database-errors.js";
import {
  CANCEL_PATH,
  FAKE_VIEW,
  FIXED_404,
  TRACKING_HEADER,
  TRACKING_PATH,
  TRACKING_RESPONSE_HEADERS,
} from "../support/tracking-http.js";
import { generateTrackingToken } from "../support/order-request.js";
import { captureLogs } from "./support/log-capture.js";
import { startTrackingApp } from "./support/start-tracking-app.js";
import type { TrackingServiceDouble } from "./support/start-tracking-app.js";
import { buildTestConfig } from "./support/test-config.js";

describe("the tracking routes over HTTP", () => {
  let app: NestExpressApplication;
  const getTracking = vi.fn<TrackingServiceDouble["getTracking"]>();
  const cancelOrder = vi.fn<TrackingServiceDouble["cancelOrder"]>();
  const logs = captureLogs();
  const clock = {
    current: new Date("2026-10-08T08:00:00.000Z"),
    now() {
      return this.current;
    },
  };
  let addressCounter = 0;

  beforeAll(async () => {
    app = await startTrackingApp(buildTestConfig({ TRUST_PROXY: "1", LOG_LEVEL: "info" }), {
      service: { getTracking, cancelOrder },
      clock,
      logs: logs.stream,
    });
  });
  beforeEach(() => {
    getTracking.mockReset();
    cancelOrder.mockReset();
    getTracking.mockResolvedValue(FAKE_VIEW);
    cancelOrder.mockResolvedValue(FAKE_VIEW);
    logs.reset();
  });
  afterAll(async () => {
    await app.close();
  });

  // A new address per request keeps the limit out of the other tests.
  function nextAddress(): string {
    addressCounter += 1;
    return `198.51.100.${String(addressCounter % 250)}`;
  }

  function get(token?: string, address: string = nextAddress()): request.Test {
    const call = request(app.getHttpServer()).get(TRACKING_PATH).set("X-Forwarded-For", address);
    return token === undefined ? call : call.set(TRACKING_HEADER, token);
  }

  function cancel(token?: string, address: string = nextAddress()): request.Test {
    const call = request(app.getHttpServer()).post(CANCEL_PATH).set("X-Forwarded-For", address);
    return token === undefined ? call : call.set(TRACKING_HEADER, token);
  }

  it("answers the view with the shared schema on GET", async () => {
    const token = generateTrackingToken();

    const response = await get(token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(FAKE_VIEW);
    expect(getTracking).toHaveBeenCalledWith(token);
  });

  it("ignores the query string: a token there is not read", async () => {
    const response = await request(app.getHttpServer())
      .get(`${TRACKING_PATH}?token=${generateTrackingToken()}`)
      .set("X-Forwarded-For", nextAddress());

    expect(response.status).toBe(404);
    expect(getTracking).not.toHaveBeenCalled();
  });

  describe("a token that is absent or malformed", () => {
    it.each([
      ["absent", undefined],
      ["too short", "A".repeat(42)],
      ["too long", "A".repeat(44)],
      ["outside the alphabet", `${"A".repeat(42)}+`],
    ])("gets the one fixed 404 before the service (%s)", async (_label, token) => {
      const response = await get(token);

      expect(response.status).toBe(404);
      expect(response.body).toEqual(FIXED_404);
      expect(getTracking).not.toHaveBeenCalled();
    });

    it("gets exactly the answer of an unknown token", async () => {
      getTracking.mockRejectedValue(new TrackingNotFoundError());
      const unknown = await get(generateTrackingToken());
      const malformed = await get("short");

      expect(malformed.status).toBe(unknown.status);
      expect(malformed.body).toEqual(unknown.body);
      expect(malformed.headers["content-type"]).toBe(unknown.headers["content-type"]);
    });
  });

  describe("the three protection headers", () => {
    const cases: readonly (readonly [number, () => void])[] = [
      [200, () => undefined],
      [404, () => getTracking.mockRejectedValue(new TrackingNotFoundError())],
      [409, () => getTracking.mockRejectedValue(new OrderNotCancellableError())],
      [429, () => getTracking.mockRejectedValue(new AddressRateLimitedError())],
      [503, () => getTracking.mockRejectedValue(buildObservedDatabaseError("connection"))],
      [500, () => getTracking.mockRejectedValue(new Error("secret internal detail"))],
    ];

    it.each(cases)("are on the %i answer", async (status, arrange) => {
      arrange();

      const response = await get(generateTrackingToken());

      expect(response.status).toBe(status);
      expect(response.headers).toMatchObject(TRACKING_RESPONSE_HEADERS);
    });

    it("are on the answer of a limited address, which never reaches a route", async () => {
      const address = nextAddress();
      for (let count = 0; count < 120; count += 1) {
        await get(generateTrackingToken(), address);
      }

      const response = await get(generateTrackingToken(), address);

      expect(response.status).toBe(429);
      expect(response.headers).toMatchObject(TRACKING_RESPONSE_HEADERS);
      expect(response.headers["retry-after"]).toBe("600");
    });
  });

  describe("POST /cancel", () => {
    it("answers the view and passes the token", async () => {
      const token = generateTrackingToken();

      const response = await cancel(token);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(FAKE_VIEW);
      expect(cancelOrder).toHaveBeenCalledWith(token);
    });

    it("answers a fixed 409 for an order that cannot be cancelled", async () => {
      cancelOrder.mockRejectedValue(new OrderNotCancellableError());

      const response = await cancel(generateTrackingToken());

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ status: 409, instance: CANCEL_PATH });
    });

    it("ignores a body, even one that is not valid JSON", async () => {
      const response = await cancel(generateTrackingToken())
        .set("Content-Type", "application/json")
        .send("{ not json");

      expect(response.status).toBe(200);
      expect(cancelOrder).toHaveBeenCalledOnce();
    });

    it("gives the same fixed 404 for an absent token", async () => {
      const response = await cancel();

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ...FIXED_404, instance: CANCEL_PATH });
      expect(cancelOrder).not.toHaveBeenCalled();
    });
  });

  it("limits both routes together, before the service and before any body is read", async () => {
    const address = nextAddress();
    for (let count = 0; count < 60; count += 1) {
      await get(generateTrackingToken(), address);
      await cancel(generateTrackingToken(), address);
    }
    getTracking.mockClear();
    cancelOrder.mockClear();

    const response = await cancel(generateTrackingToken(), address)
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("600");
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  it("does not share its counter with the order creation limit", async () => {
    const address = nextAddress();
    for (let count = 0; count < 25; count += 1) {
      await request(app.getHttpServer())
        .post("/api/v1/orders")
        .set("X-Forwarded-For", address)
        .send("{}");
    }

    const response = await get(generateTrackingToken(), address);

    expect(response.status).toBe(200);
  });
});
