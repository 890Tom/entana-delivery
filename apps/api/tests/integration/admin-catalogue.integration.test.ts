import { adminProductListResponseSchema, adminProductSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { newKey } from "../support/order-http.js";
import { buildOrderRequest } from "../support/order-request.js";
import { useAdminOrdersHarness } from "./support/admin-orders-harness.js";
import { insertProduct } from "./support/insert-product.js";
import { createOrdersService } from "./support/orders-fixtures.js";

const PRODUCTS_PATH = "/api/v1/admin/products";
const PUBLIC_PRODUCTS_PATH = "/api/v1/products";
const UNKNOWN_ID = "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5f";
const NOT_FOUND = { status: 404, detail: "The requested resource was not found." };
const EARLIER = new Date("2026-01-01T00:00:00.000Z");

describe("the administration of the catalogue on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();
  const availabilityPath = (id: string): string => `${PRODUCTS_PATH}/${id}/availability`;
  const retirePath = (id: string): string => `${PRODUCTS_PATH}/${id}/retire`;
  const restorePath = (id: string): string => `${PRODUCTS_PATH}/${id}/restore`;
  const orderPath = `${PRODUCTS_PATH}/order`;

  const publicIds = async (): Promise<string[]> => {
    const answer = await h.get(PUBLIC_PRODUCTS_PATH, null);
    const body = answer.body as { products: { id: string }[] };
    return body.products.map((product) => product.id);
  };
  const adminIds = async (): Promise<string[]> => {
    const answer = await h.get(PRODUCTS_PATH);
    return adminProductListResponseSchema.parse(answer.body).products.map((product) => product.id);
  };
  const auditRows = () => h.client.auditLog.findMany({ orderBy: { id: "asc" } });
  const stored = (id: string) =>
    h.client.product.findUniqueOrThrow({
      where: { id },
      select: { active: true, available: true, availabilityChangedAt: true, position: true },
    });

  describe("without a session", () => {
    it("closes the five routes with the same 401", async () => {
      const calls = [
        h.get(PRODUCTS_PATH, null),
        h.patch(availabilityPath(UNKNOWN_ID), { available: true }, null),
        h.post(retirePath(UNKNOWN_ID), {}, null),
        h.post(restorePath(UNKNOWN_ID), {}, null),
        h.put(orderPath, { ids: [] }, null),
      ];

      const answers = await Promise.all(calls);

      expect(answers.map((answer) => answer.status)).toEqual([401, 401, 401, 401, 401]);
    });
  });

  describe("the list", () => {
    it("holds the unavailable and the retired products, by position then id", async () => {
      const second = await insertProduct(h.client, { position: 1, name: "B" });
      const first = await insertProduct(h.client, { position: 0, name: "A" });
      const unavailable = await insertProduct(h.client, { position: 2, available: false });
      const retired = await insertProduct(h.client, { position: 3, active: false });

      const answer = await h.get(PRODUCTS_PATH);

      const { products } = adminProductListResponseSchema.parse(answer.body);
      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(products.map((product) => product.id)).toEqual([first, second, unavailable, retired]);
      expect(products[2]).toMatchObject({ available: false, retired: false, position: 2 });
      expect(products[3]).toMatchObject({
        retired: true,
        availabilityChangedAt: EARLIER.toISOString(),
      });
      expect(products[0]?.sku).toMatch(/^SKU-/);
    });
  });

  describe("the availability", () => {
    it("changes available and its date, answers the product and writes one audit entry", async () => {
      const id = await insertProduct(h.client, { available: true });

      const answer = await h.patch(availabilityPath(id), { available: false });

      const product = adminProductSchema.parse(answer.body);
      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(product).toMatchObject({
        id,
        available: false,
        availabilityChangedAt: h.clock.now().toISOString(),
      });
      expect((await stored(id)).availabilityChangedAt).toEqual(h.clock.now());
      expect(await auditRows()).toMatchObject([
        {
          actorId: h.adminId,
          action: "product.availability_changed",
          entity: "product",
          entityId: id,
          diff: { available: { from: true, to: false } },
        },
      ]);
    });

    it("answers 200 with the product, the date unchanged and no audit, for the same value", async () => {
      const id = await insertProduct(h.client, { available: true });

      const answer = await h.patch(availabilityPath(id), { available: true });

      expect(answer.status).toBe(200);
      expect(adminProductSchema.parse(answer.body).availabilityChangedAt).toBe(
        EARLIER.toISOString(),
      );
      expect((await stored(id)).availabilityChangedAt).toEqual(EARLIER);
      expect(await auditRows()).toEqual([]);
    });

    it("answers 409 for a retired product and changes nothing", async () => {
      const id = await insertProduct(h.client, { active: false, available: true });

      const answer = await h.patch(availabilityPath(id), { available: false });

      expect(answer.status).toBe(409);
      expect(await stored(id)).toMatchObject({ available: true, availabilityChangedAt: EARLIER });
      expect(await auditRows()).toEqual([]);
    });
  });

  describe("the retirement", () => {
    it("takes the product out of the public catalogue and of the order creation, and keeps the orders", async () => {
      const id = await insertProduct(h.client, { name: "Retired soon", priceAr: 5000 });
      const kept = await insertProduct(h.client);
      const service = createOrdersService(h.client, { clock: h.clock });
      const placed = await service.createOrder(
        buildOrderRequest([{ productId: id, quantity: 1 }]),
        newKey(),
      );
      const code = placed.response.orderCode;

      const answer = await h.post(retirePath(id), undefined);

      expect(answer.status).toBe(200);
      expect(adminProductSchema.parse(answer.body)).toMatchObject({ id, retired: true });
      expect(await publicIds()).toEqual([kept]);
      const refused = await service
        .createOrder(
          buildOrderRequest([{ productId: id, quantity: 1 }], { phone: "034 98 765 44" }),
          newKey(),
        )
        .catch((error: unknown) => error);
      expect(refused).toMatchObject({ name: "UnavailableProductsError" });
      const order = await h.client.customerOrder.findUniqueOrThrow({
        where: { publicCode: code },
        select: { items: { select: { productId: true, productName: true } } },
      });
      expect(order.items).toEqual([{ productId: id, productName: "Retired soon" }]);
      expect(await auditRows()).toMatchObject([
        { action: "product.retired", entityId: id, diff: { active: { from: true, to: false } } },
      ]);
    });

    it("answers 200 without change nor audit for a product that is already retired", async () => {
      const id = await insertProduct(h.client, { active: false });

      const answer = await h.post(retirePath(id), undefined);

      expect(answer.status).toBe(200);
      expect(adminProductSchema.parse(answer.body).retired).toBe(true);
      expect(await auditRows()).toEqual([]);
    });
  });

  describe("the restoration", () => {
    it("makes the product active, unavailable and last, and writes an audit entry", async () => {
      await insertProduct(h.client, { position: 4 });
      const id = await insertProduct(h.client, { active: false, available: true, position: 1 });
      await insertProduct(h.client, { active: false, position: 9 });

      const answer = await h.post(restorePath(id), undefined);

      const product = adminProductSchema.parse(answer.body);
      expect(answer.status).toBe(200);
      expect(product).toMatchObject({
        retired: false,
        available: false,
        position: 10,
        availabilityChangedAt: h.clock.now().toISOString(),
      });
      expect(await publicIds()).toContain(id);
      expect((await adminIds()).at(-1)).toBe(id);
      expect(await auditRows()).toMatchObject([
        { action: "product.restored", entityId: id, diff: { active: { from: false, to: true } } },
      ]);
    });

    it("answers 200 without change nor audit for a product that is already active", async () => {
      const id = await insertProduct(h.client, { available: true, position: 3 });

      const answer = await h.post(restorePath(id), undefined);

      expect(answer.status).toBe(200);
      expect(await stored(id)).toMatchObject({
        available: true,
        position: 3,
        availabilityChangedAt: EARLIER,
      });
      expect(await auditRows()).toEqual([]);
    });

    it("answers 409 for a product that has no photo, which cannot be visible", async () => {
      const id = await h.client.product.create({
        data: {
          sku: "SKU-NO-PHOTO",
          name: "No photo",
          priceAr: 1000,
          active: false,
          available: false,
          availabilityChangedAt: EARLIER,
          position: 0,
        },
        select: { id: true },
      });

      const answer = await h.post(restorePath(id.id), undefined);

      expect(answer.status).toBe(409);
      expect((await stored(id.id)).active).toBe(false);
      expect(await auditRows()).toEqual([]);
    });
  });

  describe("the order", () => {
    it("rewrites the positions from 0, answers the list and the public catalogue follows", async () => {
      const a = await insertProduct(h.client, { position: 0 });
      const b = await insertProduct(h.client, { position: 1 });
      const c = await insertProduct(h.client, { position: 2 });
      const retired = await insertProduct(h.client, { active: false, position: 3 });

      const answer = await h.put(orderPath, { ids: [c, a, b] });

      const { products } = adminProductListResponseSchema.parse(answer.body);
      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(products.map((product) => product.id)).toEqual([c, a, b, retired]);
      expect(products.slice(0, 3).map((product) => product.position)).toEqual([0, 1, 2]);
      expect(await publicIds()).toEqual([c, a, b]);
      expect(await auditRows()).toEqual([]);
    });

    it.each([
      ["an incomplete set", (ids: string[]) => ids.slice(1)],
      ["a duplicate", (ids: string[]) => [ids[0] ?? "", ...ids.slice(0, 1), ...ids.slice(2)]],
      ["an unknown product", (ids: string[]) => [...ids.slice(1), UNKNOWN_ID]],
    ])("answers 409 for %s and writes nothing", async (_label, mutate) => {
      const ids = [
        await insertProduct(h.client, { position: 0 }),
        await insertProduct(h.client, { position: 1 }),
        await insertProduct(h.client, { position: 2 }),
      ];

      const answer = await h.put(orderPath, { ids: mutate(ids) });

      expect(answer.status).toBe(409);
      expect(await adminIds()).toEqual(ids);
      expect(
        (
          await h.client.product.findMany({
            select: { position: true },
            orderBy: { position: "asc" },
          })
        ).map((row) => row.position),
      ).toEqual([0, 1, 2]);
    });

    it("answers 409 for a list that holds a retired product and writes nothing", async () => {
      const active = await insertProduct(h.client, { position: 0 });
      const retired = await insertProduct(h.client, { active: false, position: 7 });

      const answer = await h.put(orderPath, { ids: [retired, active] });

      expect(answer.status).toBe(409);
      expect((await stored(active)).position).toBe(0);
      expect((await stored(retired)).position).toBe(7);
    });
  });

  describe("an id or a body that is not valid", () => {
    it.each([
      ["an unknown id", UNKNOWN_ID],
      ["an id that is not an id", "not-an-id"],
    ])("answers the same 404 on every route for %s", async (_label, id) => {
      const answers = await Promise.all([
        h.patch(availabilityPath(id), { available: true }),
        h.post(retirePath(id), undefined),
        h.post(restorePath(id), undefined),
      ]);

      for (const answer of answers) {
        expect(answer.status).toBe(404);
        expect(answer.body).toMatchObject(NOT_FOUND);
      }
    });

    it.each([
      ["availability: a value that is not a boolean", "patch", { available: "yes" }],
      ["availability: a field in excess", "patch", { available: true, priceAr: 1 }],
      ["order: an id that is not a uuid", "put", { ids: ["x"] }],
      ["order: a field in excess", "put", { ids: [], extra: true }],
    ] as const)("answers 400 for %s", async (_label, method, body) => {
      const id = await insertProduct(h.client);
      const path = method === "patch" ? availabilityPath(id) : orderPath;

      const answer = await h[method](path, body);

      expect(answer.status).toBe(400);
    });
  });
});
