import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildObservedDatabaseError } from "../support/observed-database-errors.js";
import { FAKE_PHONE_INPUT } from "../support/order-request.js";
import {
  CustomerBlockedError,
  IdempotencyConflictError,
  InvalidPhoneError,
  OrderCreationFailedError,
  OrderRateLimitedError,
  OrderTooLargeError,
  UnavailableProductsError,
} from "../../src/orders/order-errors.js";
import type { CreateOrderResult } from "../../src/orders/orders.service.js";
import { startOrdersApp } from "./support/start-orders-app.js";
import type { OrderServiceDouble } from "./support/start-orders-app.js";
import { buildTestConfig } from "./support/test-config.js";
import {
  FIXED_429,
  ORDERS_PATH,
  buildFakeBody,
  newKey,
  problemBody,
  validationProblem,
} from "../support/order-http.js";

const CREATED: CreateOrderResult = {
  response: {
    orderCode: "ABC234",
    status: "NEW",
    totalAr: 12000,
    createdAt: "2026-10-08T08:00:00.000Z",
  },
  replayed: false,
};

describe("POST /api/v1/orders: responses", () => {
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

  describe("success", () => {
    it("answers 201 with the body of the service and no-store", async () => {
      const key = newKey();
      const body = buildFakeBody();

      const response = await postJson(body, key);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(CREATED.response);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["idempotent-replayed"]).toBeUndefined();
      expect(createOrder).toHaveBeenCalledExactlyOnceWith(body, key);
    });

    it("adds Idempotent-Replayed when the service says it is a replay", async () => {
      createOrder.mockResolvedValue({ ...CREATED, replayed: true });

      const response = await postJson(buildFakeBody());

      expect(response.status).toBe(201);
      expect(response.body).toEqual(CREATED.response);
      expect(response.headers["idempotent-replayed"]).toBe("true");
    });

    it("accepts a JSON content type with a charset", async () => {
      const response = await post()
        .set("Idempotency-Key", newKey())
        .set("Content-Type", "application/json; charset=utf-8")
        .send(JSON.stringify(buildFakeBody()));

      expect(response.status).toBe(201);
    });
  });

  describe("typed errors of the service", () => {
    const unavailableId = "00000000-0000-4000-8000-0000000000aa";
    const cases: readonly {
      name: string;
      error: () => unknown;
      status: number;
      body: Record<string, unknown>;
      headers?: Record<string, string>;
    }[] = [
      {
        name: "an invalid phone number",
        error: () => new InvalidPhoneError(),
        status: 400,
        body: validationProblem(["/phone"]),
      },
      {
        name: "a blocked customer",
        error: () => new CustomerBlockedError(),
        status: 403,
        body: problemBody(403, "Forbidden", "This order cannot be placed."),
      },
      {
        name: "an idempotency conflict",
        error: () => new IdempotencyConflictError(),
        status: 409,
        body: problemBody(
          409,
          "Conflict",
          "The idempotency key was already used for a different request.",
        ),
      },
      {
        name: "unavailable products",
        error: () => new UnavailableProductsError([unavailableId]),
        status: 422,
        body: {
          ...problemBody(422, "Unprocessable Entity", "Some products are not available."),
          productIds: [unavailableId],
        },
      },
      {
        name: "an order that is too large",
        error: () => new OrderTooLargeError(),
        status: 422,
        body: problemBody(422, "Unprocessable Entity", "The order total is too large."),
      },
      {
        name: "the per-phone limit",
        error: () => new OrderRateLimitedError(),
        status: 429,
        body: { ...FIXED_429 },
        headers: { "retry-after": "3600" },
      },
      {
        name: "a creation that failed after several attempts",
        error: () => new OrderCreationFailedError(),
        status: 500,
        body: problemBody(500, "Internal Server Error", "An unexpected error occurred."),
      },
      {
        name: "an unknown error carrying a phone number",
        error: () => new Error(`boom ${FAKE_PHONE_INPUT}`),
        status: 500,
        body: problemBody(500, "Internal Server Error", "An unexpected error occurred."),
      },
      {
        name: "a database that cannot be reached",
        error: () => buildObservedDatabaseError("connection"),
        status: 503,
        body: problemBody(503, "Service Unavailable", "The service is temporarily unavailable."),
      },
    ];

    it.each(cases)("maps $name to its exact fixed body", async (testCase) => {
      createOrder.mockRejectedValue(testCase.error());

      const response = await postJson(buildFakeBody());

      expect(response.status).toBe(testCase.status);
      expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).toEqual(testCase.body);
      for (const [name, value] of Object.entries(testCase.headers ?? {})) {
        expect(response.headers[name]).toBe(value);
      }
      expect(response.headers["idempotent-replayed"]).toBeUndefined();
    });
  });
});
