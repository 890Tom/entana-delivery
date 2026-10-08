import http from "node:http";
import type { AddressInfo } from "node:net";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateOrderResult } from "../../src/orders/orders.service.js";
import { startOrdersApp } from "./support/start-orders-app.js";
import type { OrderServiceDouble } from "./support/start-orders-app.js";
import { buildTestConfig } from "./support/test-config.js";
import {
  HEADER_POINTER,
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

// Two header lines with the same name, which supertest's `.set` cannot send.
async function postWithTwoKeys(
  app: NestExpressApplication,
  body: string,
): Promise<{ status: number; body: unknown }> {
  const server = app.getHttpServer();
  const { port } = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const outgoing = http.request(
      {
        port,
        host: "127.0.0.1",
        method: "POST",
        path: ORDERS_PATH,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": [newKey(), newKey()],
          "X-Forwarded-For": "198.51.100.251",
        },
      },
      (incoming) => {
        let text = "";
        incoming.on("data", (chunk: Buffer) => {
          text += chunk.toString();
        });
        incoming.on("end", () => {
          resolve({ status: incoming.statusCode ?? 0, body: JSON.parse(text) as unknown });
        });
      },
    );
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

describe("POST /api/v1/orders: validation", () => {
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

  describe("content type and headers", () => {
    it("answers a fixed 415 for another content type, without reading the key or the body", async () => {
      const response = await post()
        .set("Idempotency-Key", newKey())
        .set("Content-Type", "text/plain")
        .send(JSON.stringify(buildFakeBody()));

      expect(response.status).toBe(415);
      expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(response.body).toEqual(
        problemBody(
          415,
          "Unsupported Media Type",
          "The content type of the request is not supported.",
        ),
      );
      expect(createOrder).not.toHaveBeenCalled();
    });

    it("answers 415 before looking at the key: a bad key with another content type is still a 415", async () => {
      const response = await post()
        .set("Idempotency-Key", "FAKE-NOT-A-UUID")
        .set("Content-Type", "text/plain")
        .send("FAKE-BODY");

      expect(response.status).toBe(415);
      expect(response.text).not.toContain("FAKE-");
    });

    it.each([
      "APPLICATION/JSON",
      "application/jsonx",
      "application/json5",
      "application/vnd.api+json",
    ])("answers 415 for the content type %s", async (contentType) => {
      const response = await post()
        .set("Idempotency-Key", newKey())
        .set("Content-Type", contentType)
        .send(JSON.stringify(buildFakeBody()));

      expect(response.status).toBe(contentType === "APPLICATION/JSON" ? 201 : 415);
    });

    it("answers 415 when there is no content type at all", async () => {
      const response = await post().set("Idempotency-Key", newKey());

      expect(response.status).toBe(415);
    });

    it("answers 400 naming only the header when the key is missing", async () => {
      const response = await post()
        .set("Content-Type", "application/json")
        .send(JSON.stringify(buildFakeBody()));

      expect(response.status).toBe(400);
      expect(response.body).toEqual(validationProblem([HEADER_POINTER]));
      expect(createOrder).not.toHaveBeenCalled();
    });

    it.each([
      ["not a uuid", "FAKE-KEY-VALUE-5521"],
      ["empty", ""],
      ["a uuid and some text", `${newKey()} FAKE-SUFFIX-5521`],
    ])("answers 400 naming only the header when the key is %s", async (_name, key) => {
      const response = await postJson(buildFakeBody(), key);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(validationProblem([HEADER_POINTER]));
      expect(JSON.stringify(response.body)).not.toContain("FAKE-");
    });

    it("answers 400 when the header is sent twice, even with two valid uuids", async () => {
      const response = await postWithTwoKeys(app, JSON.stringify(buildFakeBody()));

      expect(response.status).toBe(400);
      expect(response.body).toEqual(validationProblem([HEADER_POINTER]));
      expect(createOrder).not.toHaveBeenCalled();
    });
  });

  describe("body", () => {
    // The body parser reads the whole body before it answers 413, so the client never sees a reset.
    it("answers 413 for a body of 1 MB", async () => {
      const response = await postJson({ ...buildFakeBody(), customerNote: "x".repeat(1_000_000) });

      expect(response.status).toBe(413);
      expect(response.body).toEqual(
        problemBody(413, "Payload Too Large", "The request body is too large."),
      );
    });

    it("answers 400 for a body that is not JSON, without quoting it", async () => {
      const response = await postJson('{"phone": FAKE-BROKEN-8841');

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).not.toContain("FAKE-BROKEN");
    });

    it("answers 400 for an own __proto__ key, which must not be silently dropped", async () => {
      const raw = JSON.stringify(buildFakeBody()).replace("{", '{"__proto__":{"isAdmin":true},');

      const response = await postJson(raw);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(validationProblem([""]));
      expect(createOrder).not.toHaveBeenCalled();
    });

    it.each([
      ["a price", { priceAr: 1 }],
      ["a total", { totalAr: 1 }],
      ["a delivery fee", { deliveryFee: 0 }],
      ["a status", { status: "CONFIRMED" }],
      ["a customer id", { customerId: newKey() }],
      ["an unknown property", { somethingElse: true }],
    ])("answers 400 for %s sent by the client", async (_name, extra) => {
      const response = await postJson({ ...buildFakeBody(), ...extra });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(validationProblem([""]));
      expect(createOrder).not.toHaveBeenCalled();
    });

    it("names only the invalid field for an invalid location", async () => {
      const response = await postJson({ ...buildFakeBody(), location: { lat: 91, lng: 47.5 } });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(validationProblem(["/location/lat"]));
      expect(createOrder).not.toHaveBeenCalled();
    });

    it.each([[null], [[]], ["text"], [42]])(
      "answers 400 for a JSON body that is %j",
      async (body) => {
        const response = await postJson(JSON.stringify(body));

        expect(response.status).toBe(400);
        expect(createOrder).not.toHaveBeenCalled();
      },
    );

    it("never echoes the value of an invalid field", async () => {
      const response = await postJson({
        ...buildFakeBody(),
        phone: "FAKE-PHONE-VALUE-7731",
        contactName: 4242424242,
        trackingToken: "FAKE-TOKEN-VALUE-9917",
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        validationProblem(["/phone", "/trackingToken", "/contactName"]),
      );
      expect(response.text).not.toMatch(/FAKE-|4242424242/);
    });
  });
});
