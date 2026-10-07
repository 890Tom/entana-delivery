import { randomUUID } from "node:crypto";
import { productListResponseSchema, publicProductSchema } from "@entana/contracts";
import { createPrismaClient } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";
import { CatalogService } from "../../src/catalog/catalog.service.js";
import { assertThrowawayDatabase } from "./support/assert-throwaway-database.js";

const client = createPrismaClient({
  connectionString: inject("throwawayConnectionString"),
  maxConnections: 1,
});
const service = new CatalogService(client);

interface ProductSeed {
  id?: string;
  name?: string;
  description?: string | null;
  priceAr?: number;
  active?: boolean;
  available?: boolean;
  position?: number;
}

// Satisfies ck_product_photo_when_active (an active row has a photo) and ck_product_price_positive.
// The values are unique per call: the sku is unique in the database and the others make a mix-up visible.
async function insertProduct(database: PrismaClient, seed: ProductSeed = {}): Promise<string> {
  const unique = randomUUID();
  const created = await database.product.create({
    data: {
      ...(seed.id === undefined ? {} : { id: seed.id }),
      sku: `SKU-${unique}`,
      name: seed.name ?? `Product ${unique}`,
      description: seed.description === undefined ? `Description ${unique}` : seed.description,
      priceAr: seed.priceAr ?? 5000,
      active: seed.active ?? true,
      available: seed.available ?? true,
      availabilityChangedAt: new Date("2026-01-01T00:00:00.000Z"),
      position: seed.position ?? 0,
      imageKey: `products/${unique}.jpg`,
      imageAlt: `Photo ${unique}`,
    },
    select: { id: true },
  });
  return created.id;
}

describe("CatalogService against a real PostgreSQL", () => {
  beforeEach(async () => {
    await assertThrowawayDatabase(client);
    await client.product.deleteMany();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("returns only the active products", async () => {
    const activeId = await insertProduct(client, { active: true });
    await insertProduct(client, { active: false });

    const { products } = await service.listActiveProducts();

    expect(products.map((product) => product.id)).toEqual([activeId]);
  });

  it("returns an unavailable product with available false", async () => {
    const id = await insertProduct(client, { available: false });

    const { products } = await service.listActiveProducts();

    expect(products).toMatchObject([{ id, available: false }]);
  });

  it("returns an empty list for an empty catalogue", async () => {
    await expect(service.listActiveProducts()).resolves.toEqual({ products: [] });
  });

  it("orders by position, then name, then id, whatever the insertion order", async () => {
    const lowId = "00000000-0000-4000-8000-000000000001";
    const highId = "00000000-0000-4000-8000-000000000002";
    // Inserted in an order that differs from the expected one.
    const lastPosition = await insertProduct(client, { position: 20, name: "A" });
    const sameNameHighId = await insertProduct(client, { position: 10, name: "Pear", id: highId });
    const secondName = await insertProduct(client, { position: 10, name: "Quince" });
    const sameNameLowId = await insertProduct(client, { position: 10, name: "Pear", id: lowId });
    const first = await insertProduct(client, { position: 5, name: "Z" });

    const { products } = await service.listActiveProducts();

    expect(products.map((product) => product.id)).toEqual([
      first,
      sameNameLowId,
      sameNameHighId,
      secondName,
      lastPosition,
    ]);
  });

  it("returns a response the contract accepts, with exactly the contract's keys", async () => {
    await insertProduct(client, { position: 1 });
    await insertProduct(client, { position: 2, available: false });

    const response = await service.listActiveProducts();

    expect(productListResponseSchema.safeParse(response).success).toBe(true);
    const contractKeys = Object.keys(publicProductSchema.shape).sort();
    expect(response.products).toHaveLength(2);
    for (const product of response.products) {
      expect(Object.keys(product).sort()).toEqual(contractKeys);
      expect(Object.keys(product.image).sort()).toEqual(["alt", "key"]);
    }
  });

  it("returns a blank description as null", async () => {
    await insertProduct(client, { description: "   " });

    const { products } = await service.listActiveProducts();

    expect(products[0]?.description).toBeNull();
  });

  it("returns prices as integers", async () => {
    await insertProduct(client, { priceAr: 12345 });

    const { products } = await service.listActiveProducts();

    expect(products[0]?.priceAr).toBe(12345);
    expect(Number.isInteger(products[0]?.priceAr)).toBe(true);
  });

  it("rejects when the database cannot be reached", async () => {
    const unreachable = createPrismaClient({
      connectionString: "postgresql://nobody:nothing@127.0.0.1:1/none",
      maxConnections: 1,
      connectionTimeoutMs: 1000,
    });

    try {
      await expect(new CatalogService(unreachable).listActiveProducts()).rejects.toBeDefined();
    } finally {
      await unreachable.$disconnect();
    }
  });
});
