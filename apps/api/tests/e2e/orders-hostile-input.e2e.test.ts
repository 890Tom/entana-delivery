import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateOrderResult } from "../../src/orders/orders.service.js";
import { startOrdersApp } from "./support/start-orders-app.js";
import type { OrderServiceDouble } from "./support/start-orders-app.js";
import { buildTestConfig } from "./support/test-config.js";
import { ORDERS_PATH, buildFakeBody, newKey, validationProblem } from "../support/order-http.js";

const CREATED: CreateOrderResult = {
  response: {
    orderCode: "ABC234",
    status: "NEW",
    totalAr: 12000,
    createdAt: "2026-10-08T08:00:00.000Z",
  },
  replayed: false,
};

describe("POST /api/v1/orders: hostile input", () => {
  let app: NestExpressApplication;
  const createOrder = vi.fn<OrderServiceDouble["createOrder"]>();

  beforeAll(async () => {
    app = await startOrdersApp(buildTestConfig({ TRUST_PROXY: "1" }), {
      service: { createOrder },
    });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    createOrder.mockReset();
    createOrder.mockResolvedValue(CREATED);
  });

  // Each test uses its own address, so that the per-address limit never interferes.
  let addressCounter = 0;
  function post(): request.Test {
    addressCounter += 1;
    return request(app.getHttpServer())
      .post(ORDERS_PATH)
      .set("X-Forwarded-For", `198.51.100.${String(addressCounter % 250)}`);
  }

  function postJson(body: unknown, key: string = newKey()): request.Test {
    return post()
      .set("Idempotency-Key", key)
      .set("Content-Type", "application/json")
      .send(typeof body === "string" ? body : JSON.stringify(body));
  }

  describe("own __proto__ keys", () => {
    // Made by JSON.parse like a client's body would be.
    const pollutedValue = (): object => JSON.parse('{"__proto__":{"polluted":true}}') as object;

    it.each([
      ["the body", [""], (): Record<string, unknown> => ({ ...pollutedValue() })],
      [
        "location",
        ["/location"],
        (): Record<string, unknown> => ({
          location: { lat: 1, lng: 1, ...pollutedValue() },
        }),
      ],
      [
        "an item",
        ["/items/0"],
        (): Record<string, unknown> => ({
          items: [
            {
              productId: "00000000-0000-4000-8000-000000000001",
              quantity: 1,
              ...pollutedValue(),
            },
          ],
        }),
      ],
    ])(
      "answers 400 for one inside %s, names its parent, and pollutes nothing",
      async (_name, pointers, make) => {
        const body = JSON.stringify({ ...buildFakeBody(), ...make() });
        expect(body).toContain('"__proto__"');

        const response = await postJson(body);

        expect(response.status).toBe(400);
        expect(response.body).toEqual(validationProblem(pointers));
        expect(createOrder).not.toHaveBeenCalled();
        expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      },
    );
  });

  describe("hostile property names", () => {
    const hostileKeys: readonly (readonly [string, string])[] = [
      ["10 000 characters", "k".repeat(10_000)],
      ["a newline", "line1\nline2-FAKE-NEWLINE"],
      ["html", "<script>alert('FAKE-HTML')</script>"],
      ["a right-to-left override", "‮gnp.FAKE-RTL"],
      ["a constructor name", "constructor"],
      ["a prototype name", "prototype"],
    ];

    it.each(hostileKeys)("does not repeat an unknown key made of %s", async (_name, key) => {
      const body = JSON.stringify({ ...buildFakeBody(), [key]: "FAKE-VALUE-4417" });

      const response = await postJson(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(validationProblem([""]));
      expect(response.text).not.toContain(key.slice(0, 40));
      expect(response.text).not.toContain("FAKE-");
      expect(JSON.stringify(response.headers)).not.toContain("FAKE-");
      expect(response.text.length).toBeLessThan(500);
    });

    it("does not repeat a hostile key nested in the location", async () => {
      const body = { ...buildFakeBody(), location: { lat: 1, lng: 1, "<b>FAKE-NESTED</b>": 1 } };

      const response = await postJson(body);

      expect(response.body).toEqual(validationProblem(["/location"]));
      expect(response.text).not.toContain("FAKE-NESTED");
    });
  });

  describe("array indexes in the pointer", () => {
    // A distinct product per index, so that only the quantity is wrong.
    const itemOf = (quantity: unknown, index = 0): Record<string, unknown> => ({
      productId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      quantity,
    });

    it("points at an object where an array was expected, with no index", async () => {
      const response = await postJson({ ...buildFakeBody(), items: { "0": itemOf(1, 0) } });

      expect(response.body).toEqual(validationProblem(["/items"]));
    });

    it("points at a negative quantity by the index in the structure", async () => {
      const response = await postJson({ ...buildFakeBody(), items: [itemOf(1, 0), itemOf(-1, 1)] });

      expect(response.body).toEqual(validationProblem(["/items/1/quantity"]));
    });

    it("points at a huge index without growing, whatever the size of the array", async () => {
      const items = Array.from({ length: 1000 }, (_, index) => itemOf(1, index));
      items[999] = itemOf(-5, 999);

      const response = await postJson({ ...buildFakeBody(), items });

      expect(response.status).toBe(400);
      const pointers = (response.body as { errors: { pointer: string }[] }).errors.map(
        (error) => error.pointer,
      );
      for (const pointer of pointers) {
        expect(pointer).toMatch(/^\/[a-zA-Z]+(\/\d{1,4}(\/[a-zA-Z]+)?)?$/);
      }
      expect(response.text.length).toBeLessThan(20_000);
    });
  });
});
