import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderRateLimitedError } from "../../src/orders/order-errors.js";
import type { CreateOrderResult } from "../../src/orders/orders.service.js";
import { captureLogs } from "./support/log-capture.js";
import { postOversizedBody } from "./support/raw-requests.js";
import { startOrdersApp } from "./support/start-orders-app.js";
import type { OrderServiceDouble } from "./support/start-orders-app.js";
import { buildTestConfig } from "./support/test-config.js";
import { FIXED_429, ORDERS_PATH, buildFakeBody, newKey } from "../support/order-http.js";

const CREATED: CreateOrderResult = {
  response: {
    orderCode: "ABC234",
    status: "NEW",
    totalAr: 12000,
    createdAt: "2026-10-08T08:00:00.000Z",
  },
  replayed: false,
};

const CREATED_RESPONSE = {
  orderCode: "ABC234",
  status: "NEW",
  totalAr: 12000,
  createdAt: "2026-10-08T08:00:00.000Z",
} as const;

const VOLATILE_HEADERS = ["date", "x-request-id"];

function withoutVolatileHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !VOLATILE_HEADERS.includes(name)),
  );
}

describe("POST /api/v1/orders: the limit per address", () => {
  let app: NestExpressApplication;
  const clock = {
    current: new Date("2026-10-08T08:00:00.000Z"),
    now() {
      return this.current;
    },
  };
  const createOrder = vi.fn<OrderServiceDouble["createOrder"]>();
  const logs = captureLogs();

  beforeEach(async () => {
    createOrder.mockReset();
    createOrder.mockResolvedValue(CREATED);
    clock.current = new Date("2026-10-08T08:00:00.000Z");
    logs.reset();
    app = await startOrdersApp(buildTestConfig({ TRUST_PROXY: "1", LOG_LEVEL: "info" }), {
      service: { createOrder },
      clock,
      logs: logs.stream,
    });
  });
  afterEach(async () => {
    await app.close();
  });

  function from(address: string, body: unknown = buildFakeBody()): request.Test {
    return request(app.getHttpServer())
      .post(ORDERS_PATH)
      .set("X-Forwarded-For", address)
      .set("Idempotency-Key", newKey())
      .set("Content-Type", "application/json")
      .send(JSON.stringify(body));
  }

  async function exhaust(address: string): Promise<void> {
    for (let count = 0; count < 20; count += 1) {
      expect((await from(address)).status).toBe(201);
    }
  }

  it("refuses the 21st request of an address within 10 minutes, with a fixed Retry-After", async () => {
    await exhaust("203.0.113.1");

    const response = await from("203.0.113.1");

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("600");
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual(FIXED_429);
    expect(createOrder).toHaveBeenCalledTimes(20);
  });

  it("counts invalid requests and replays too", async () => {
    for (let count = 0; count < 20; count += 1) {
      await from("203.0.113.2", { nonsense: true });
    }

    expect((await from("203.0.113.2")).status).toBe(429);
  });

  it("slides: requests are accepted again as the oldest ones leave the window", async () => {
    await exhaust("203.0.113.3");
    clock.current = new Date(clock.current.getTime() + 599_000);
    expect((await from("203.0.113.3")).status).toBe(429);

    clock.current = new Date(clock.current.getTime() + 1_000);

    expect((await from("203.0.113.3")).status).toBe(201);
  });

  it("does not affect another address", async () => {
    await exhaust("203.0.113.4");

    expect((await from("203.0.113.5")).status).toBe(201);
  });

  it("treats the IPv4-mapped IPv6 form and the plain form as one address", async () => {
    for (let count = 0; count < 10; count += 1) {
      await from("203.0.113.6");
      await from("::ffff:203.0.113.6");
    }

    expect((await from("203.0.113.6")).status).toBe(429);
    expect((await from("::ffff:203.0.113.6")).status).toBe(429);
  });

  it("answers 429, not 413, to a limited address that sends a body above the size limit", async () => {
    await exhaust("203.0.113.7");
    createOrder.mockClear();

    const response = await postOversizedBody(app, "203.0.113.7");

    expect(response.status).toBe(429);
    expect(response.body).toEqual(FIXED_429);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("is applied before the body is validated and before the service", async () => {
    await exhaust("203.0.113.8");
    createOrder.mockClear();

    const response = await request(app.getHttpServer())
      .post(ORDERS_PATH)
      .set("X-Forwarded-For", "203.0.113.8")
      .set("Content-Type", "text/plain")
      .send("not json");

    expect(response.status).toBe(429);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it.each(["/api/v1/orders/", "/API/V1/Orders"])(
    "counts the same address when the path is written %s",
    async (path) => {
      for (let count = 0; count < 20; count += 1) {
        await request(app.getHttpServer())
          .post(path)
          .set("X-Forwarded-For", "203.0.113.13")
          .set("Content-Type", "application/json")
          .send("{}");
      }

      expect((await from("203.0.113.13")).status).toBe(429);
    },
  );

  it("does not limit other routes or methods", async () => {
    await exhaust("203.0.113.9");

    const products = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("X-Forwarded-For", "203.0.113.9");

    expect(products.status).toBe(200);
  });

  it("gives the refused response a request id, and echoes a valid one sent by the client", async () => {
    await exhaust("203.0.113.14");

    const generated = await from("203.0.113.14");
    const echoed = await from("203.0.113.14").set("X-Request-Id", "client-request-id-42");
    const rejected = await from("203.0.113.14").set("X-Request-Id", "bad id with spaces!");

    expect(generated.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(echoed.headers["x-request-id"]).toBe("client-request-id-42");
    expect(rejected.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("answers an identical body for the address limit and for the phone limit", async () => {
    await exhaust("203.0.113.10");
    const byAddress = await from("203.0.113.10");
    createOrder.mockRejectedValue(new OrderRateLimitedError());
    const byPhone = await from("203.0.113.11");

    expect(byAddress.status).toBe(429);
    expect(byPhone.status).toBe(429);
    expect(byPhone.text).toBe(byAddress.text);
    expect(byPhone.body).toEqual(FIXED_429);
    expect(byAddress.headers["retry-after"]).toBe("600");
    // Whole header set: only the values that change on every response may differ, but both
    // responses must carry the same header names.
    expect(Object.keys(byPhone.headers).sort()).toEqual(Object.keys(byAddress.headers).sort());
    expect(withoutVolatileHeaders(byPhone.headers)).toEqual(
      withoutVolatileHeaders(byAddress.headers),
    );
  });

  it("writes one line for a refused request, with no body, header, query or address", async () => {
    await exhaust("203.0.113.12");
    logs.reset();

    await from("203.0.113.12");

    const lines = logs.entries();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 40, msg: "order_creation_address_limited" });
    expect(logs.text()).not.toMatch(/203\.0\.113|FAKE|Idempotency|forwarded/i);
  });
});

describe("POST /api/v1/orders: the limit per address without TRUST_PROXY", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startOrdersApp(buildTestConfig(), {
      service: {
        createOrder: () => Promise.resolve({ response: CREATED_RESPONSE, replayed: false }),
      },
    });
  });
  afterAll(async () => {
    await app.close();
  });

  function from(forwardedFor: string): request.Test {
    return request(app.getHttpServer())
      .post(ORDERS_PATH)
      .set("X-Forwarded-For", forwardedFor)
      .set("Idempotency-Key", newKey())
      .set("Content-Type", "application/json")
      .send(JSON.stringify(buildFakeBody()));
  }

  it("ignores X-Forwarded-For, so rotating it gives no new counter", async () => {
    for (let count = 0; count < 20; count += 1) {
      expect((await from(`198.51.100.${String(count)}`)).status).toBe(201);
    }

    const response = await from("198.51.100.200");

    expect(response.status).toBe(429);
  });
});
