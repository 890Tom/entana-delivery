import { ORDER_CODE_ALPHABET } from "@entana/contracts";
import type { CreateOrderRequest } from "@entana/contracts";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import {
  CustomerBlockedError,
  OrderCreationFailedError,
  OrderRateLimitedError,
} from "../../src/orders/order-errors.js";
import {
  FAKE_CONTACT_NAME,
  FAKE_LANDMARK,
  FAKE_LAT,
  FAKE_LNG,
  FAKE_NOTE,
  FAKE_PHONE_E164,
  FAKE_PHONE_INPUT,
  buildOrderRequest,
  generateTrackingToken,
} from "../support/order-request.js";
import { countRows } from "./support/count-rows.js";
import { insertProduct } from "./support/insert-product.js";
import {
  ManualClock,
  captureError,
  createOrdersService,
  describeError,
  openOrdersClient,
  resetOrderData,
} from "./support/orders-fixtures.js";

const client = openOrdersClient();
const KEY = "0190a5b2-7c3d-7e4f-8a1b-00000000000";
const keyOf = (index: number): string => `${KEY}${String(index).padStart(2, "0")}`;

async function orderFor(overrides: Partial<CreateOrderRequest> = {}): Promise<CreateOrderRequest> {
  const product = await client.product.findFirstOrThrow({ select: { id: true } });
  return buildOrderRequest([{ productId: product.id, quantity: 1 }], overrides);
}

describe("OrdersService.createOrder refusals and failures", () => {
  beforeEach(async () => {
    await resetOrderData(client);
    await insertProduct(client, { priceAr: 5000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    // The other suites of this database delete products, which the order items reference.
    await resetOrderData(client);
    await client.$disconnect();
  });

  describe("a blocked customer", () => {
    it("is refused before anything is written, and the customer is left as it was", async () => {
      await client.customer.create({ data: { phoneE164: FAKE_PHONE_E164, trustLevel: "BLOCKED" } });
      const customerBefore = await client.customer.findMany();
      const countsBefore = await countRows(client);

      const error = await captureError(
        createOrdersService(client).createOrder(await orderFor(), keyOf(1)),
      );

      expect(error).toBeInstanceOf(CustomerBlockedError);
      expect(await countRows(client)).toEqual(countsBefore);
      expect(await client.customer.findMany()).toEqual(customerBefore);
    });

    it("still gets the same response for an order that already exists", async () => {
      const service = createOrdersService(client);
      const request = await orderFor();
      const original = await service.createOrder(request, keyOf(1));
      await client.customer.update({
        where: { phoneE164: FAKE_PHONE_E164 },
        data: { trustLevel: "BLOCKED" },
      });

      const replay = await service.createOrder(request, keyOf(1));
      const fresh = await captureError(service.createOrder(await orderFor(), keyOf(2)));

      expect(replay).toEqual({ response: original.response, replayed: true });
      expect(fresh).toBeInstanceOf(CustomerBlockedError);
    });
  });

  describe("the per-phone limit", () => {
    const phoneFormats = [
      "034 98 765 43",
      "0349876543",
      "+261349876543",
      "00261349876543",
      "(034) 98-765-43",
    ];

    it("refuses the sixth order of an hour, whatever way the number is written", async () => {
      const service = createOrdersService(client);
      for (const [index, phone] of phoneFormats.entries()) {
        await service.createOrder(await orderFor({ phone }), keyOf(index));
      }
      const before = await countRows(client);

      const error = await captureError(
        service.createOrder(await orderFor({ phone: "+261 34 98 765 43" }), keyOf(9)),
      );

      expect(error).toBeInstanceOf(OrderRateLimitedError);
      expect(await countRows(client)).toEqual(before);
    });

    it.each([
      [60, true],
      [60 + 1 / 60_000, false],
    ])("with the oldest order %d minutes old, limited is %s", async (minutes, isLimited) => {
      const clock = new ManualClock();
      const service = createOrdersService(client, { clock });
      for (let index = 0; index < 5; index += 1) {
        await service.createOrder(await orderFor(), keyOf(index));
      }
      clock.advanceMilliseconds(minutes * 60_000);

      const outcome = await service.createOrder(await orderFor(), keyOf(9)).then(
        () => "created",
        (error: unknown) => (error instanceof OrderRateLimitedError ? "limited" : "other"),
      );

      expect(outcome).toBe(isLimited ? "limited" : "created");
    });

    it("does not count a replay of an existing order", async () => {
      const service = createOrdersService(client);
      for (let index = 0; index < 4; index += 1) {
        await service.createOrder(await orderFor(), keyOf(index));
      }
      const fifth = await orderFor();
      await service.createOrder(fifth, keyOf(4));

      const replay = await service.createOrder(fifth, keyOf(4));

      expect(replay.replayed).toBe(true);
      expect(await client.customerOrder.count()).toBe(5);
    });

    it("counts only the orders of the last 60 minutes", async () => {
      const clock = new ManualClock();
      const service = createOrdersService(client, { clock });
      for (let index = 0; index < 5; index += 1) {
        await service.createOrder(await orderFor(), keyOf(index));
      }
      clock.advanceMinutes(59);
      const stillLimited = await captureError(service.createOrder(await orderFor(), keyOf(7)));
      clock.advanceMinutes(2);

      const later = await service.createOrder(await orderFor(), keyOf(8));

      expect(stillLimited).toBeInstanceOf(OrderRateLimitedError);
      expect(later.replayed).toBe(false);
    });

    it("counts the orders of one customer only", async () => {
      const service = createOrdersService(client);
      for (let index = 0; index < 5; index += 1) {
        await service.createOrder(await orderFor(), keyOf(index));
      }

      const other = await service.createOrder(await orderFor({ phone: "034 11 222 33" }), keyOf(9));

      expect(other.replayed).toBe(false);
    });
  });

  describe("order code and token collisions", () => {
    const sourceOf = (...codes: string[]): ((count: number) => Uint8Array) => {
      let call = 0;
      return (count) => {
        const code = codes[Math.min(call, codes.length - 1)] ?? "AAAAAA";
        call += 1;
        expect(count).toBe(6);
        return Uint8Array.from(code, (character) => ORDER_CODE_ALPHABET.indexOf(character));
      };
    };

    it("asks the random source for exactly 6 bytes", async () => {
      const randomBytes = vi.fn((count: number) => new Uint8Array(count));

      await createOrdersService(client, { randomBytes }).createOrder(await orderFor(), keyOf(1));

      expect(randomBytes).toHaveBeenCalledExactlyOnceWith(6);
    });

    it("retries with a new code when the code is already taken", async () => {
      await createOrdersService(client, { randomBytes: sourceOf("AAAAAA") }).createOrder(
        await orderFor({ phone: "034 11 222 33" }),
        keyOf(1),
      );
      const service = createOrdersService(client, { randomBytes: sourceOf("AAAAAA", "BBBBBB") });

      const { response } = await service.createOrder(await orderFor(), keyOf(2));

      expect(response.orderCode).toBe("BBBBBB");
      expect(await client.customerOrder.count()).toBe(2);
    });

    it("fails with a typed error after five attempts and leaves no partial row", async () => {
      await createOrdersService(client, { randomBytes: sourceOf("AAAAAA") }).createOrder(
        await orderFor({ phone: "034 11 222 33" }),
        keyOf(1),
      );
      const before = await countRows(client);
      const randomBytes = vi.fn(sourceOf("AAAAAA"));

      const error = await captureError(
        createOrdersService(client, { randomBytes }).createOrder(await orderFor(), keyOf(2)),
      );

      expect(error).toBeInstanceOf(OrderCreationFailedError);
      expect((error as Error).message).toBe("Order creation failed after several attempts.");
      expect(randomBytes).toHaveBeenCalledTimes(5);
      expect(await countRows(client)).toEqual(before);
    });

    it("fails cleanly when a token is reused under another key, with no partial row", async () => {
      const service = createOrdersService(client);
      const first = await orderFor();
      await service.createOrder(first, keyOf(1));
      const before = await countRows(client);
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

      const error = await captureError(
        service.createOrder(await orderFor({ trackingToken: first.trackingToken }), keyOf(2)),
      );

      expect(error).toBeInstanceOf(OrderCreationFailedError);
      expect(await countRows(client)).toEqual(before);
      expect(warn).toHaveBeenCalledOnce();
      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).toContain("order_creation_attempts_exhausted");
      for (const secret of [first.trackingToken, FAKE_PHONE_E164, FAKE_PHONE_INPUT]) {
        expect(logged).not.toContain(secret);
      }
    });
  });

  describe("a failure after the order insert", () => {
    const installFailingTrigger = async (): Promise<void> => {
      await client.$executeRawUnsafe(
        `CREATE FUNCTION fail_order_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END $$`,
      );
      await client.$executeRawUnsafe(
        "CREATE TRIGGER fail_order_event BEFORE INSERT ON order_event FOR EACH ROW EXECUTE FUNCTION fail_order_event()",
      );
    };
    const removeFailingTrigger = async (): Promise<void> => {
      await client.$executeRawUnsafe("DROP TRIGGER IF EXISTS fail_order_event ON order_event");
      await client.$executeRawUnsafe("DROP FUNCTION IF EXISTS fail_order_event()");
    };

    it("leaves no order, no item and no customer created by the attempt", async () => {
      const request = await orderFor();
      await installFailingTrigger();
      try {
        const error = await captureError(
          createOrdersService(client).createOrder(request, keyOf(1)),
        );

        expect(error).not.toBeInstanceOf(OrderCreationFailedError);
        expect(describeError(error)).toContain("forced failure");
        expect(await client.orderEvent.count()).toBe(0);
        expect(await client.customerOrder.count()).toBe(0);
        expect(await client.orderItem.count()).toBe(0);
        expect(await client.customer.count()).toBe(0);
        const text = describeError(error);
        for (const secret of [
          FAKE_PHONE_E164,
          FAKE_CONTACT_NAME,
          FAKE_NOTE,
          FAKE_LANDMARK,
          request.trackingToken,
        ]) {
          expect(text).not.toContain(secret);
        }
      } finally {
        await removeFailingTrigger();
      }
    });

    it("does not modify a customer that already existed", async () => {
      await client.customer.create({ data: { phoneE164: FAKE_PHONE_E164, trustLevel: "KNOWN" } });
      const before = await client.customer.findMany();
      await installFailingTrigger();
      try {
        await captureError(createOrdersService(client).createOrder(await orderFor(), keyOf(1)));

        expect(await client.customer.findMany()).toEqual(before);
        expect(await client.customerOrder.count()).toBe(0);
      } finally {
        await removeFailingTrigger();
      }
    });
  });

  it("never puts the coordinates, the phone or the token in a refusal", async () => {
    await client.customer.create({ data: { phoneE164: FAKE_PHONE_E164, trustLevel: "BLOCKED" } });
    const request = await orderFor({ trackingToken: generateTrackingToken() });

    const text = describeError(
      await captureError(createOrdersService(client).createOrder(request, keyOf(1))),
    );

    for (const secret of [
      FAKE_PHONE_E164,
      FAKE_PHONE_INPUT,
      String(FAKE_LAT),
      String(FAKE_LNG),
      request.trackingToken,
      FAKE_LANDMARK,
    ]) {
      expect(text).not.toContain(secret);
    }
  });
});
