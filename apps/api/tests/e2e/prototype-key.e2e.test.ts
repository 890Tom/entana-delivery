import { problemDetailsSchema } from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateOrderResult } from "../../src/orders/orders.service.js";
import { startAppWithProbe } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import { startOrdersApp } from "./support/start-orders-app.js";
import type { OrderServiceDouble } from "./support/start-orders-app.js";
import { buildTestConfig } from "./support/test-config.js";
import { ORDERS_PATH, buildFakeBody, newKey, problemBody } from "../support/order-http.js";

const REFUSED = problemBody(400, "Bad Request", "The request body is not acceptable.");
const ITEM = { productId: "00000000-0000-4000-8000-000000000001", quantity: 1 };
const CREATED: CreateOrderResult = {
  response: {
    orderCode: "ABC234",
    status: "NEW",
    totalAr: 12000,
    deliveryFeeAr: 0,
    createdAt: "2026-10-08T08:00:00.000Z",
  },
  replayed: false,
};

// Made by JSON.parse like a client's body: an object literal would set the prototype instead.
function polluted(): object {
  return JSON.parse('{"__proto__":{"polluted":true}}') as object;
}

function expectPrototypeIntact(): void {
  expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
}

type Place = "root" | "location" | "item" | "deep";

function withBodyAt(place: Place): string {
  const base = buildFakeBody();
  const bodies: Record<string, unknown> = {
    root: { ...base, ...polluted() },
    location: { ...base, location: { lat: 1, lng: 1, ...polluted() } },
    item: { ...base, items: [{ ...ITEM, ...polluted() }] },
    deep: { ...base, extra: { a: { b: { c: [{ d: { ...polluted() } }] } } } },
  };
  return JSON.stringify(bodies[place]);
}

describe("an own __proto__ key in a JSON body", () => {
  const createOrder = vi.fn<OrderServiceDouble["createOrder"]>();
  const logs = captureLogs();
  let orders: NestExpressApplication;
  let probe: NestExpressApplication;
  let address = 0;

  beforeAll(async () => {
    orders = await startOrdersApp(buildTestConfig({ TRUST_PROXY: "1", BODY_LIMIT_KB: "4096" }), {
      service: { createOrder },
      logs: logs.stream,
    });
    probe = await startAppWithProbe(
      buildTestConfig({ BODY_LIMIT_KB: "4096", LOG_LEVEL: "trace" }),
      logs.stream,
    );
  });
  afterAll(async () => {
    await orders.close();
    await probe.close();
  });
  beforeEach(() => {
    createOrder.mockReset();
    createOrder.mockResolvedValue(CREATED);
    logs.reset();
  });

  function postOrder(body: string): request.Test {
    address += 1;
    return request(orders.getHttpServer())
      .post(ORDERS_PATH)
      .set("X-Forwarded-For", `198.51.100.${String(address % 250)}`)
      .set("Idempotency-Key", newKey())
      .set("Content-Type", "application/json")
      .send(body);
  }

  it.each<Place>(["root", "location", "item", "deep"])(
    "is refused with a fixed 400 on the order route, from %s",
    async (place) => {
      const body = withBodyAt(place);
      expect(body).toContain('"__proto__"');

      const response = await postOrder(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(REFUSED);
      expect(createOrder).not.toHaveBeenCalled();
      expectPrototypeIntact();
    },
  );

  it.each(["/api/v1/probe/validation", "/api/v1/probe/strict"])(
    "is refused with the same fixed 400 on the test-only route %s",
    async (path) => {
      const response = await request(probe.getHttpServer())
        .post(path)
        .set("Content-Type", "application/json")
        .send('{"name":"abc","quantity":1,"__proto__":{"polluted":true}}');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ...REFUSED, instance: path });
      expectPrototypeIntact();
    },
  );

  it("is not echoed in the response, the headers or the logs", async () => {
    const response = await postOrder(withBodyAt("deep"));

    expect(response.text).not.toContain("__proto__");
    expect(JSON.stringify(response.headers)).not.toContain("__proto__");
    expect(logs.text()).not.toContain("polluted");
  });

  it("accepts a value that only contains the text, because only keys are refused", async () => {
    const response = await postOrder(JSON.stringify(buildFakeBody({ contactName: "__proto__" })));

    expect(response.status).toBe(201);
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it("answers 415 for a hostile body of another content type, without reading it", async () => {
    address += 1;
    const response = await request(orders.getHttpServer())
      .post(ORDERS_PATH)
      .set("X-Forwarded-For", `198.51.100.${String(address % 250)}`)
      .set("Idempotency-Key", newKey())
      .set("Content-Type", "text/plain")
      .send(withBodyAt("root"));

    expect(response.status).toBe(415);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("reports only the header when the key and the body are both invalid", async () => {
    address += 1;
    const response = await request(orders.getHttpServer())
      .post(ORDERS_PATH)
      .set("X-Forwarded-For", `198.51.100.${String(address % 250)}`)
      .set("Idempotency-Key", "FAKE-KEY-5521")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ ...buildFakeBody(), extra: 1 }));

    expect(response.status).toBe(400);
    expect(response.text).not.toContain("FAKE-KEY-5521");
    expect(problemDetailsSchema.parse(response.body).errors).toEqual([
      {
        pointer: "/headers/idempotencyKey",
        detail: "This field does not have the expected format.",
      },
    ]);
  });

  it("answers an unknown route with 400 when the body carries the key (the check is global)", async () => {
    const response = await request(probe.getHttpServer())
      .post("/api/v1/FAKE-unknown")
      .set("Content-Type", "application/json")
      .send('{"__proto__":{}}');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ ...REFUSED, instance: "/api/v1/FAKE-unknown" });
  });

  describe("a body that would exhaust the walk", () => {
    it("refuses a body 100 000 levels deep and keeps serving", async () => {
      const response = await postOrder("[".repeat(100_000) + "]".repeat(100_000));

      expect(response.status).toBe(400);
      expect(createOrder).not.toHaveBeenCalled();
      expect((await postOrder(JSON.stringify(buildFakeBody()))).status).toBe(201);
    });

    it("refuses a body of 1 000 000 nodes and keeps serving", async () => {
      const response = await postOrder(`[${"0,".repeat(999_999)}0]`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(REFUSED);
      expect((await postOrder(JSON.stringify(buildFakeBody()))).status).toBe(201);
    });
  });
});
