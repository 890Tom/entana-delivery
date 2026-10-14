import { createOrderRequestSchema, createOrderResponseSchema } from "@entana/contracts";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hashTrackingToken } from "../../src/orders/rules/hash-tracking-token.js";
import {
  InvalidPhoneError,
  OrderTooLargeError,
  UnavailableProductsError,
} from "../../src/orders/errors/order-errors.js";
import {
  FAKE_CONTACT_NAME,
  FAKE_LANDMARK,
  FAKE_LAT,
  FAKE_LNG,
  FAKE_NOTE,
  FAKE_PHONE_E164,
  FAKE_PHONE_INPUT,
  buildOrderRequest,
} from "../support/order-request.js";
import { countRows } from "./support/count-rows.js";
import { insertProduct } from "./support/insert-product.js";
import {
  OUT_OF_AXIS_FEE_AR,
  START,
  captureError,
  countCellsContaining,
  createOrdersService,
  describeError,
  openOrdersClient,
  resetDeliveryRules,
  resetOrderData,
} from "./support/orders-fixtures.js";

const client = openOrdersClient();
const service = createOrdersService(client);
const KEY = "0190a5b2-7c3d-7e4f-8a1b-000000000001";

async function twoProducts(): Promise<{ first: string; second: string }> {
  const first = await insertProduct(client, { name: "Frozen name one", priceAr: 5000 });
  const second = await insertProduct(client, { name: "Frozen name two", priceAr: 1250 });
  return { first, second };
}

describe("OrdersService.createOrder against a real PostgreSQL", () => {
  beforeEach(async () => {
    await resetOrderData(client);
    await resetDeliveryRules(client);
  });

  afterAll(async () => {
    // The other suites of this database delete products, which the order items reference.
    await resetOrderData(client);
    await client.$disconnect();
  });

  describe("a normal order", () => {
    it("writes the order, its items and its creation event with the frozen values", async () => {
      const { first, second } = await twoProducts();
      const request = buildOrderRequest([
        { productId: first, quantity: 2 },
        { productId: second, quantity: 3 },
      ]);

      const { response, replayed: isReplay } = await service.createOrder(request, KEY);

      expect(isReplay).toBe(false);
      expect(createOrderResponseSchema.safeParse(response).success).toBe(true);
      expect(response).toMatchObject({
        status: "NEW",
        totalAr: 2 * 5000 + 3 * 1250 + OUT_OF_AXIS_FEE_AR,
        deliveryFeeAr: OUT_OF_AXIS_FEE_AR,
      });
      expect(response.createdAt).toBe(START.toISOString());
      const customer = await client.customer.findUniqueOrThrow({
        where: { phoneE164: FAKE_PHONE_E164 },
      });
      expect(customer.trustLevel).toBe("NEW");
      const order = await client.customerOrder.findUniqueOrThrow({
        where: { idempotencyKey: KEY },
        include: { items: true, events: true },
      });
      expect(order).toMatchObject({
        publicCode: response.orderCode,
        publicTokenHash: hashTrackingToken(request.trackingToken),
        customerId: customer.id,
        placeId: null,
        axisId: null,
        deliveryFee: OUT_OF_AXIS_FEE_AR,
        feeReason: "OUT_OF_AXIS",
        deliveryDate: null,
        status: "NEW",
        statusReason: null,
        contactName: FAKE_CONTACT_NAME,
        customerNote: FAKE_NOTE,
        landmarkText: FAKE_LANDMARK,
        lat: FAKE_LAT,
        lng: FAKE_LNG,
        totalAr: 13750 + OUT_OF_AXIS_FEE_AR,
        createdAt: START,
      });
      expect(
        order.items.map((item) => [item.productId, item.productName, item.qty, item.unitPrice]),
      ).toEqual(
        expect.arrayContaining([
          [first, "Frozen name one", 2, 5000],
          [second, "Frozen name two", 3, 1250],
        ]),
      );
      expect(order.items).toHaveLength(2);
      expect(order.events).toHaveLength(1);
      expect(order.events[0]).toMatchObject({
        type: "STATUS_CHANGED",
        fromStatus: null,
        toStatus: "NEW",
        actorType: "CUSTOMER",
        actorId: customer.id,
        payload: {},
      });
    });

    it("stores no customer note as null", async () => {
      const { first } = await twoProducts();
      const request = {
        ...buildOrderRequest([{ productId: first, quantity: 1 }]),
        customerNote: undefined,
      };

      await service.createOrder(request, KEY);

      const order = await client.customerOrder.findUniqueOrThrow({
        where: { idempotencyKey: KEY },
      });
      expect(order.customerNote).toBeNull();
    });

    it("stores the raw tracking token in no column of any table", async () => {
      const { first } = await twoProducts();
      const request = buildOrderRequest([{ productId: first, quantity: 1 }]);

      await service.createOrder(request, KEY);

      expect(await countCellsContaining(client, request.trackingToken)).toBe(0);
      // Positive control: the search does find a value that is stored.
      expect(await countCellsContaining(client, hashTrackingToken(request.trackingToken))).toBe(1);
    });

    it("keeps the price of the order when the product price changes afterwards", async () => {
      const { first } = await twoProducts();
      await service.createOrder(buildOrderRequest([{ productId: first, quantity: 2 }]), KEY);

      await client.product.update({
        where: { id: first },
        data: { priceAr: 9999, name: "Renamed" },
      });

      const order = await client.customerOrder.findUniqueOrThrow({
        where: { idempotencyKey: KEY },
        include: { items: true },
      });
      expect(order.totalAr).toBe(10000 + OUT_OF_AXIS_FEE_AR);
      expect(order.items[0]).toMatchObject({ unitPrice: 5000, productName: "Frozen name one" });
    });

    it("is rejected by the schema when the request carries a price or a total", async () => {
      const { first } = await twoProducts();
      const forged = {
        ...buildOrderRequest([{ productId: first, quantity: 1 }]),
        totalAr: 1,
        items: [{ productId: first, quantity: 1, unitPrice: 1 }],
      };

      expect(createOrderRequestSchema.safeParse(forged).success).toBe(false);
    });
  });

  describe("refused requests", () => {
    it.each(["unknown", "inactive", "unavailable"])(
      "refuses a product that is %s and names only the ids the client sent",
      async (kind) => {
        const good = await insertProduct(client);
        const bad =
          kind === "unknown"
            ? "11111111-2222-4333-8444-555555555555"
            : await insertProduct(
                client,
                kind === "inactive" ? { active: false } : { available: false },
              );
        const request = buildOrderRequest([
          { productId: good, quantity: 1 },
          { productId: bad, quantity: 1 },
        ]);
        const before = await countRows(client);

        const error = await captureError(service.createOrder(request, KEY));

        expect(error).toBeInstanceOf(UnavailableProductsError);
        expect((error as UnavailableProductsError).productIds).toEqual([bad]);
        expect(await countRows(client)).toEqual(before);
      },
    );

    it("lists every unusable product, in the order of the request", async () => {
      const inactive = await insertProduct(client, { active: false });
      const unavailable = await insertProduct(client, { available: false });
      const request = buildOrderRequest([
        { productId: unavailable, quantity: 1 },
        { productId: inactive, quantity: 1 },
      ]);

      const error = await captureError(service.createOrder(request, KEY));

      expect((error as UnavailableProductsError).productIds).toEqual([unavailable, inactive]);
    });

    it("refuses a phone number that cannot be normalised, with a fixed message", async () => {
      const { first } = await twoProducts();
      const request = buildOrderRequest([{ productId: first, quantity: 1 }], { phone: "12345" });
      const before = await countRows(client);

      const error = await captureError(service.createOrder(request, KEY));

      expect(error).toBeInstanceOf(InvalidPhoneError);
      expect(describeError(error)).not.toContain("12345");
      expect(await countRows(client)).toEqual(before);
    });

    it("refuses a total that does not fit the database column, and writes nothing", async () => {
      const expensive = await insertProduct(client, { priceAr: 100_000_000 });
      const request = buildOrderRequest([{ productId: expensive, quantity: 99 }]);
      const before = await countRows(client);

      const error = await captureError(service.createOrder(request, KEY));

      expect(error).toBeInstanceOf(OrderTooLargeError);
      expect(await countRows(client)).toEqual(before);
    });

    it("accepts a total, delivery fee included, exactly at the column bound", async () => {
      const product = await insertProduct(client, { priceAr: 2_147_483_647 - OUT_OF_AXIS_FEE_AR });

      const { response } = await service.createOrder(
        buildOrderRequest([{ productId: product, quantity: 1 }]),
        KEY,
      );

      expect(response.totalAr).toBe(2_147_483_647);
    });

    it("leaks no personal data in any refusal", async () => {
      const bad = "11111111-2222-4333-8444-555555555555";
      const request = buildOrderRequest([{ productId: bad, quantity: 1 }]);

      const text = describeError(await captureError(service.createOrder(request, KEY)));

      for (const secret of [
        FAKE_PHONE_INPUT,
        FAKE_PHONE_E164,
        FAKE_CONTACT_NAME,
        FAKE_NOTE,
        FAKE_LANDMARK,
        String(FAKE_LAT),
        String(FAKE_LNG),
        request.trackingToken,
        hashTrackingToken(request.trackingToken),
      ]) {
        expect(text).not.toContain(secret);
      }
    });
  });
});
