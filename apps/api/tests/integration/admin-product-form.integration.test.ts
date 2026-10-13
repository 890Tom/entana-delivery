import { adminProductSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { gradientJpeg } from "./support/gradient-image.js";
import { useAdminOrdersHarness } from "./support/admin-orders-harness.js";
import { insertProduct } from "./support/insert-product.js";

const PRODUCTS_PATH = "/api/v1/admin/products";
const UNKNOWN_ID = "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5f";
const EARLIER = new Date("2026-01-01T00:00:00.000Z");
const VALID = { name: "Savon", priceAr: 4500, sku: "SAV-001" };

describe("the product form of the administration on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();
  const photoPath = (id: string): string => `${PRODUCTS_PATH}/${id}/photo`;
  const productPath = (id: string): string => `${PRODUCTS_PATH}/${id}`;
  const auditRows = () => h.client.auditLog.findMany({ orderBy: { id: "asc" } });
  const stored = (id: string) => h.client.product.findUniqueOrThrow({ where: { id } });
  const create = async (body: object = VALID): Promise<string> => {
    const answer = await h.post(PRODUCTS_PATH, body);
    return adminProductSchema.parse(answer.body).id;
  };

  describe("without a session", () => {
    it("closes the three new routes with 401", async () => {
      const photo = await gradientJpeg(900, 900);

      const answers = await Promise.all([
        h.post(PRODUCTS_PATH, VALID, null),
        h.patch(productPath(UNKNOWN_ID), { priceAr: 1 }, null),
        h.putPhoto(photoPath(UNKNOWN_ID), photo, { cookie: null }),
      ]);

      expect(answers.map((answer) => answer.status)).toEqual([401, 401, 401]);
    });
  });

  describe("the creation", () => {
    it("adds the product at the end of the list with the defaults and writes the audit", async () => {
      await insertProduct(h.client, { position: 4 });

      const answer = await h.post(PRODUCTS_PATH, VALID);

      const product = adminProductSchema.parse(answer.body);
      expect(answer.status).toBe(201);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(product).toMatchObject({
        name: "Savon",
        sku: "SAV-001",
        priceAr: 4500,
        available: true,
        retired: true,
        description: null,
        image: null,
        imageAlt: null,
        position: 5,
      });
      expect(await auditRows()).toMatchObject([
        { actorId: h.adminId, action: "product.created", entity: "product", entityId: product.id },
      ]);
    });

    it("keeps the description and the alternative text, and shows them before any photo", async () => {
      const answer = await h.post(PRODUCTS_PATH, {
        ...VALID,
        description: "Un savon",
        imageAlt: "Un savon blanc",
        available: false,
      });

      expect(adminProductSchema.parse(answer.body)).toMatchObject({
        description: "Un savon",
        image: null,
        imageAlt: "Un savon blanc",
        available: false,
      });
    });

    it("answers 409 sku_taken for a duplicate sku, case ignored", async () => {
      await create();

      const answer = await h.post(PRODUCTS_PATH, { ...VALID, name: "Autre", sku: "sav-001" });

      expect(answer.status).toBe(409);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:sku_taken" });
      expect(await h.client.product.count()).toBe(1);
    });

    it.each([
      ["an invalid body", { ...VALID, priceAr: 0 }],
      ["a field in excess", { ...VALID, position: 3 }],
      ["retired, which a creation does not take", { ...VALID, retired: false }],
    ])("answers 400 for %s", async (_label, body) => {
      const answer = await h.post(PRODUCTS_PATH, body);

      expect(answer.status).toBe(400);
      expect(await h.client.product.count()).toBe(0);
    });
  });

  describe("the update", () => {
    it("writes the changed fields, answers the product and audits the fields and the price", async () => {
      const id = await insertProduct(h.client, { name: "Old", priceAr: 1000, position: 2 });

      const answer = await h.patch(productPath(id), { name: "New", priceAr: 1200 });

      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(adminProductSchema.parse(answer.body)).toMatchObject({ name: "New", priceAr: 1200 });
      expect(await auditRows()).toMatchObject([
        {
          action: "product.updated",
          entityId: id,
          diff: { fields: ["name", "priceAr"], priceAr: { from: 1000, to: 1200 } },
        },
      ]);
    });

    it("audits an availability change apart, and keeps it possible on a retired product", async () => {
      const id = await insertProduct(h.client, { active: false, available: true });

      const answer = await h.patch(productPath(id), { available: false });

      expect(answer.status).toBe(200);
      expect((await stored(id)).availabilityChangedAt).toEqual(h.clock.now());
      expect(await auditRows()).toMatchObject([
        { action: "product.availability_changed", diff: { available: { from: true, to: false } } },
      ]);
    });

    it("retires an active product and audits product.retired", async () => {
      const id = await insertProduct(h.client);

      const answer = await h.patch(productPath(id), { retired: true });

      expect(adminProductSchema.parse(answer.body).retired).toBe(true);
      expect(await auditRows()).toMatchObject([{ action: "product.retired", entityId: id }]);
    });

    it("restores as unavailable and last, with product.restored and the availability change", async () => {
      await insertProduct(h.client, { position: 6 });
      const id = await insertProduct(h.client, { active: false, available: true, position: 1 });

      const answer = await h.patch(productPath(id), { retired: false });

      expect(adminProductSchema.parse(answer.body)).toMatchObject({
        retired: false,
        available: false,
        position: 7,
        availabilityChangedAt: h.clock.now().toISOString(),
      });
      expect((await auditRows()).map((row) => row.action)).toEqual([
        "product.availability_changed",
        "product.restored",
      ]);
    });

    it("restores with the available of the request, and audits no availability change then", async () => {
      const id = await insertProduct(h.client, { active: false, available: true });

      const answer = await h.patch(productPath(id), { retired: false, available: true });

      expect(adminProductSchema.parse(answer.body)).toMatchObject({
        retired: false,
        available: true,
      });
      expect((await auditRows()).map((row) => row.action)).toEqual(["product.restored"]);
    });

    it("answers 422 for retired:false when the photo or its alternative text is missing", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon" });

      const answer = await h.patch(productPath(id), { retired: false });

      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:product_not_publishable" });
      expect((await stored(id)).active).toBe(false);
      expect((await auditRows()).map((row) => row.action)).toEqual(["product.created"]);
    });

    it("writes nothing and audits nothing when no value changes", async () => {
      const id = await insertProduct(h.client, { name: "Same", priceAr: 900 });
      const before = await stored(id);

      const answer = await h.patch(productPath(id), { name: "Same", priceAr: 900, retired: false });

      expect(answer.status).toBe(200);
      expect(await stored(id)).toEqual(before);
      expect(await auditRows()).toEqual([]);
    });

    it("answers 409 sku_taken when the sku belongs to another product", async () => {
      const taken = await create();
      const id = await insertProduct(h.client);

      const answer = await h.patch(productPath(id), { sku: "sav-001" });

      expect(answer.status).toBe(409);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:sku_taken" });
      expect(taken).not.toBe(id);
    });

    it.each([
      ["an empty body", {}],
      ["a field in excess", { priceAr: 5, id: UNKNOWN_ID }],
    ])("answers 400 for %s", async (_label, body) => {
      const id = await insertProduct(h.client);

      expect((await h.patch(productPath(id), body)).status).toBe(400);
    });

    it.each([
      ["an unknown id", UNKNOWN_ID],
      ["an id that is not an id", "not-an-id"],
    ])("answers the same 404 for %s, on the update and on the photo", async (_label, id) => {
      const answers = [
        await h.patch(productPath(id), { priceAr: 5 }),
        await h.putPhoto(photoPath(id), await gradientJpeg(900, 900)),
      ];

      expect(answers.map((answer) => answer.status)).toEqual([404, 404]);
    });
  });

  describe("the restoration route", () => {
    it("answers 422 product_not_publishable for a product without photo, like the update", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon" });

      const answer = await h.post(`${productPath(id)}/restore`, undefined);

      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:product_not_publishable" });
    });
  });

  it("leaves the date of an untouched product as it was", async () => {
    const id = await insertProduct(h.client);

    await h.patch(productPath(id), { name: "Renamed" });

    expect((await stored(id)).availabilityChangedAt).toEqual(EARLIER);
  });
});
