import { trackingResponseSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import {
  FAKE_CONTACT_NAME,
  FAKE_LANDMARK,
  FAKE_LAT,
  FAKE_LNG,
  FAKE_NOTE,
  FAKE_PHONE_E164,
  FAKE_PHONE_INPUT,
  generateTrackingToken,
} from "../support/order-request.js";
import { FIXED_404, TRACKING_PATH, TRACKING_RESPONSE_HEADERS } from "../support/tracking-http.js";
import { newKey } from "../support/order-http.js";
import { buildOrderRequest } from "../support/order-request.js";
import { insertProduct } from "./support/insert-product.js";
import { OUT_OF_AXIS_FEE_AR, createOrdersService } from "./support/orders-fixtures.js";
import { useTrackingHarness } from "./support/tracking-harness.js";

const DAY_MS = 86_400_000;

describe("reading an order by its tracking token on a real PostgreSQL", () => {
  const { client, clock, from, read, placeOrder, moveTo, request } = useTrackingHarness();

  describe("reading", () => {
    it("answers the exact schema, with the three headers, for an order made by the service", async () => {
      const { token, orderCode } = await placeOrder();

      const response = await read(token);

      expect(response.status).toBe(200);
      expect(response.headers).toMatchObject(TRACKING_RESPONSE_HEADERS);
      expect(trackingResponseSchema.parse(response.body)).toEqual({
        orderCode,
        status: "NEW",
        deliveryDate: null,
        landmarkText: FAKE_LANDMARK,
        totalAr: 10000 + OUT_OF_AXIS_FEE_AR,
        deliveryFeeAr: OUT_OF_AXIS_FEE_AR,
        itemCount: 2,
        createdAt: clock.now().toISOString(),
        rejectionReason: null,
        canCancel: true,
      });
    });

    it("answers the sum of the quantities of every line as itemCount", async () => {
      const token = generateTrackingToken();
      const productIds = [
        await insertProduct(client, { priceAr: 5000 }),
        await insertProduct(client, { priceAr: 3000 }),
      ];
      await createOrdersService(client, { clock }).createOrder(
        buildOrderRequest(
          [
            { productId: productIds[0] ?? "", quantity: 3 },
            { productId: productIds[1] ?? "", quantity: 4 },
          ],
          { trackingToken: token },
        ),
        newKey(),
      );

      const response = await read(token);

      expect(response.body).toMatchObject({ itemCount: 7 });
    });

    it("answers the generic 500 for an order without any line, never an item count of 0", async () => {
      const { token } = await placeOrder();
      await client.orderItem.deleteMany({});

      const response = await read(token);

      expect(response.status).toBe(500);
      expect(response.body).not.toHaveProperty("itemCount");
    });

    it("answers no name, phone number, coordinate, note or identifier", async () => {
      const { token } = await placeOrder();
      const order = await client.customerOrder.findFirstOrThrow({ select: { id: true } });

      const response = await read(token);

      for (const forbidden of [
        FAKE_CONTACT_NAME,
        FAKE_PHONE_INPUT,
        FAKE_PHONE_E164,
        "349876543",
        FAKE_NOTE,
        String(FAKE_LAT),
        String(FAKE_LNG),
        order.id,
      ]) {
        expect(response.text).not.toContain(forbidden);
      }
    });

    it("answers one identical 404 for an absent, malformed and unknown token", async () => {
      await placeOrder();
      const answers = await Promise.all([
        request().get(TRACKING_PATH).set("X-Forwarded-For", from()),
        read("short"),
        read(generateTrackingToken()),
      ]);

      for (const answer of answers) {
        expect(answer.status).toBe(404);
        expect(answer.body).toEqual(FIXED_404);
      }
    });

    it("exposes the day and the reason of a refusal", async () => {
      const { token, orderCode } = await placeOrder();
      await moveTo(orderCode, "REJECTED");

      const response = await read(token);

      expect(response.body).toMatchObject({
        status: "REJECTED",
        rejectionReason: "Out of stock.",
        canCancel: false,
      });
    });

    it.each([
      ["NEW", true],
      ["CONFIRMED", true],
      ["OUT_FOR_DELIVERY", false],
      ["DELIVERED", false],
      ["REJECTED", false],
      ["CANCELLED", false],
      ["FAILED", false],
    ] as const)("answers canCancel for %s", async (status, isCancellable) => {
      const { token, orderCode } = await placeOrder();
      if (status !== "NEW") {
        await moveTo(orderCode, status);
      }

      const response = await read(token);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status, canCancel: isCancellable });
    });

    it("shows the day of a confirmed order exactly as stored", async () => {
      const { token, orderCode } = await placeOrder();
      await moveTo(orderCode, "CONFIRMED");

      const response = await read(token);

      expect(response.body).toMatchObject({ deliveryDate: "2026-10-12" });
    });
  });

  describe("expiry of a final order", () => {
    it("still reads a final order whose last change is recent", async () => {
      const { token, orderCode } = await placeOrder();
      await moveTo(orderCode, "DELIVERED", new Date(clock.now().getTime() - 29 * DAY_MS));

      expect((await read(token)).status).toBe(200);
    });

    it("answers the unknown-token 404 for a final order older than 30 days", async () => {
      const { token, orderCode } = await placeOrder();
      await moveTo(orderCode, "DELIVERED", new Date(clock.now().getTime() - 31 * DAY_MS));

      const response = await read(token);

      expect(response.status).toBe(404);
      expect(response.body).toEqual(FIXED_404);
    });

    it("still reads an order that is not final, however old", async () => {
      const { token, orderCode } = await placeOrder();
      await moveTo(orderCode, "CONFIRMED", new Date(clock.now().getTime() - 90 * DAY_MS));
      clock.advanceMilliseconds(0);

      expect((await read(token)).status).toBe(200);
    });
  });
});
