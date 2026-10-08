import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@entana/database";
import { IdempotencyConflictError, OrderRateLimitedError } from "../../src/orders/order-errors.js";
import { FAKE_PHONE_INPUT, buildOrderRequest } from "../support/order-request.js";
import { insertProduct } from "./support/insert-product.js";
import {
  createOrdersService,
  openOrdersClient,
  resetOrderData,
} from "./support/orders-fixtures.js";

const client = openOrdersClient();
const service = createOrdersService(client);
const keyOf = (index: number): string =>
  `0190a5b2-7c3d-7e4f-8a1b-${String(index).padStart(12, "0")}`;

describe("OrdersService.createOrder under concurrency", () => {
  let productId = "";

  beforeEach(async () => {
    await resetOrderData(client);
    productId = await insertProduct(client, { priceAr: 5000 });
  });

  afterAll(async () => {
    // The other suites of this database delete products, which the order items reference.
    await resetOrderData(client);
    await client.$disconnect();
  });

  it("creates one order and one customer for 10 identical requests, all answered the same", async () => {
    const request = buildOrderRequest([{ productId, quantity: 1 }]);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.createOrder(request, keyOf(1))),
    );

    expect(await client.customerOrder.count()).toBe(1);
    expect(await client.customer.count()).toBe(1);
    expect(await client.orderItem.count()).toBe(1);
    expect(await client.orderEvent.count()).toBe(1);
    expect(new Set(results.map((result) => JSON.stringify(result.response))).size).toBe(1);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
  });

  it("creates one customer when two different requests race on the same phone", async () => {
    const results = await Promise.all([
      service.createOrder(buildOrderRequest([{ productId, quantity: 1 }]), keyOf(1)),
      service.createOrder(buildOrderRequest([{ productId, quantity: 2 }]), keyOf(2)),
    ]);

    expect(results.map((result) => result.replayed)).toEqual([false, false]);
    expect(await client.customer.count()).toBe(1);
    expect(await client.customerOrder.count()).toBe(2);
  });

  it("lets exactly 5 of 20 simultaneous requests from one phone through", async () => {
    const outcomes = await Promise.allSettled(
      Array.from({ length: 20 }, (_unused, index) =>
        service.createOrder(buildOrderRequest([{ productId, quantity: 1 }]), keyOf(index + 1)),
      ),
    );

    const refused = outcomes.filter(
      (outcome) => outcome.status === "rejected" && outcome.reason instanceof OrderRateLimitedError,
    );
    expect(await client.customerOrder.count()).toBe(5);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(5);
    expect(refused).toHaveLength(15);
  });

  describe("the same key with two different phone numbers", () => {
    const otherPhoneInput = "034 22 222 22";
    const repetitions = 20;

    // Counts the transactions the service opens and passes every call to the real client.
    const countTransactions = (
      real: PrismaClient,
    ): { counted: PrismaClient; count: () => number } => {
      let opened = 0;
      const counted = new Proxy(real, {
        get(target, property) {
          const value: unknown = Reflect.get(target, property);
          if (property === "$transaction") {
            opened += 1;
          }
          return typeof value === "function" ? (value.bind(target) as unknown) : value; // Bound to the real client: a function property of the client.
        },
      });
      return { counted, count: () => opened };
    };

    const clearOrders = async (): Promise<void> => {
      await client.orderEvent.deleteMany();
      await client.orderItem.deleteMany();
      await client.customerOrder.deleteMany();
      await client.customer.deleteMany();
    };

    it(`creates one order and refuses the other with a conflict, ${String(repetitions)} times`, async () => {
      for (let round = 0; round < repetitions; round += 1) {
        await clearOrders();
        const { counted, count } = countTransactions(client);
        const racing = createOrdersService(counted);
        const items = [{ productId, quantity: 1 }];
        const phones = [FAKE_PHONE_INPUT, otherPhoneInput];

        const outcomes = await Promise.allSettled(
          phones.map((phone) => racing.createOrder(buildOrderRequest(items, { phone }), keyOf(1))),
        );

        const winners = outcomes.flatMap((outcome, index) =>
          outcome.status === "fulfilled" ? [index] : [],
        );
        const losers = outcomes.flatMap((outcome) =>
          outcome.status === "rejected" ? [outcome.reason as unknown] : [],
        );
        expect(winners).toHaveLength(1);
        expect(losers).toHaveLength(1);
        expect(losers[0]).toBeInstanceOf(IdempotencyConflictError);
        expect(outcomes[winners[0] ?? 0]).toMatchObject({ value: { replayed: false } });
        // Only the winner's customer is left: the loser's was rolled back with its transaction.
        const customers = await client.customer.findMany({ select: { phoneE164: true } });
        expect(customers).toEqual([
          { phoneE164: winners[0] === 0 ? "+261349876543" : "+261342222222" },
        ]);
        expect(await client.customerOrder.count()).toBe(1);
        expect(await client.orderItem.count()).toBe(1);
        expect(await client.orderEvent.count()).toBe(1);
        // One transaction per call: the loser is answered by the re-read after its unique
        // violation, not by a second attempt.
        expect(count()).toBe(2);
      }
    });
  });
});
