import type { CreateOrderRequest } from "@entana/contracts";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { IdempotencyConflictError } from "../../src/orders/errors/order-errors.js";
import {
  FAKE_LAT,
  FAKE_LNG,
  buildOrderRequest,
  generateTrackingToken,
} from "../support/order-request.js";
import { countRows } from "./support/count-rows.js";
import { insertProduct } from "./support/insert-product.js";
import {
  captureError,
  createOrdersService,
  openOrdersClient,
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

describe("OrdersService.createOrder idempotency against a real PostgreSQL", () => {
  beforeEach(async () => {
    await resetOrderData(client);
  });

  afterAll(async () => {
    // The other suites of this database delete products, which the order items reference.
    await resetOrderData(client);
    await client.$disconnect();
  });

  describe("a replay", () => {
    it("returns the same response and writes nothing", async () => {
      const { first, second } = await twoProducts();
      const request = buildOrderRequest([
        { productId: first, quantity: 1 },
        { productId: second, quantity: 1 },
      ]);
      const original = await service.createOrder(request, KEY);
      const before = await countRows(client);
      const rowsBefore = await client.customerOrder.findMany();
      const customersBefore = await client.customer.findMany();

      const replay = await service.createOrder(request, KEY);

      expect(replay).toEqual({ response: original.response, replayed: true });
      expect(await countRows(client)).toEqual(before);
      expect(await client.customerOrder.findMany()).toEqual(rowsBefore);
      expect(await client.customer.findMany()).toEqual(customersBefore);
    });

    it("recognises the same phone number written another way", async () => {
      const { first } = await twoProducts();
      const request = buildOrderRequest([{ productId: first, quantity: 1 }]);
      const original = await service.createOrder(request, KEY);

      const replay = await service.createOrder({ ...request, phone: "+261 34 98 765 43" }, KEY);

      expect(replay).toEqual({ response: original.response, replayed: true });
    });

    it("recognises the same items in another order", async () => {
      const { first, second } = await twoProducts();
      const request = buildOrderRequest([
        { productId: first, quantity: 1 },
        { productId: second, quantity: 2 },
      ]);
      await service.createOrder(request, KEY);

      const replay = await service.createOrder(
        { ...request, items: [...request.items].reverse() },
        KEY,
      );

      expect(replay.replayed).toBe(true);
    });

    it("answers with the price frozen on the order, not the current one", async () => {
      const { first } = await twoProducts();
      const request = buildOrderRequest([{ productId: first, quantity: 2 }]);
      const original = await service.createOrder(request, KEY);
      await client.product.update({ where: { id: first }, data: { priceAr: 1, active: false } });

      const replay = await service.createOrder(request, KEY);

      expect(replay).toEqual({ response: original.response, replayed: true });
    });

    it("takes no lock on the customer", async () => {
      const { first } = await twoProducts();
      const request = buildOrderRequest([{ productId: first, quantity: 1 }]);
      const original = await service.createOrder(request, KEY);

      const outcome = await client.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM customer FOR UPDATE`;
        const timeout = new Promise<string>((resolve) =>
          setTimeout(() => {
            resolve("blocked");
          }, 5000),
        );
        return Promise.race([service.createOrder(request, KEY), timeout]);
      });

      expect(outcome).toEqual({ response: original.response, replayed: true });
    });

    it.each<[string, Partial<CreateOrderRequest>]>([
      ["another note", { customerNote: "other note" }],
      ["no note", { customerNote: undefined }],
      ["another name", { contactName: "Other Person" }],
      ["another landmark", { landmarkText: "other place" }],
      ["another location", { location: { lat: FAKE_LAT, lng: FAKE_LNG + 0.01 } }],
      ["another token", { trackingToken: generateTrackingToken() }],
      ["another phone", { phone: "034 11 111 11" }],
    ])("refuses %s under the same key, and writes nothing", async (_name, change) => {
      const { first } = await twoProducts();
      const original = buildOrderRequest([{ productId: first, quantity: 1 }]);
      await service.createOrder(original, KEY);
      const before = await countRows(client);

      const error = await captureError(service.createOrder({ ...original, ...change }, KEY));

      expect(error).toBeInstanceOf(IdempotencyConflictError);
      expect(await countRows(client)).toEqual(before);
    });

    it.each<[string, (first: string, second: string) => CreateOrderRequest["items"]]>([
      ["another quantity", (first) => [{ productId: first, quantity: 2 }]],
      ["another item", (_first, second) => [{ productId: second, quantity: 1 }]],
      [
        "an extra item",
        (first, second) => [
          { productId: first, quantity: 1 },
          { productId: second, quantity: 1 },
        ],
      ],
    ])("refuses %s under the same key, and writes nothing", async (_name, buildItems) => {
      const { first, second } = await twoProducts();
      const original = buildOrderRequest([{ productId: first, quantity: 1 }]);
      await service.createOrder(original, KEY);
      const before = await countRows(client);

      const error = await captureError(
        service.createOrder({ ...original, items: buildItems(first, second) }, KEY),
      );

      expect(error).toBeInstanceOf(IdempotencyConflictError);
      expect(await countRows(client)).toEqual(before);
    });
  });
});
