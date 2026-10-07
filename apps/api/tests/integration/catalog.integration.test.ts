import { productListResponseSchema, publicProductSchema } from "@entana/contracts";
import { classifyDatabaseError, createPrismaClient } from "@entana/database";
import { afterAll, beforeEach, describe, expect, inject, it, vi } from "vitest";
import { CatalogService } from "../../src/catalog/catalog.service.js";
import { assertThrowawayDatabase } from "./support/assert-throwaway-database.js";
import { insertProduct } from "./support/insert-product.js";

const client = createPrismaClient({
  connectionString: inject("throwawayConnectionString"),
  maxConnections: 1,
});
const service = new CatalogService(client);

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

    expect(products).toMatchObject([{ description: null }]);
  });

  it("returns prices as integers", async () => {
    await insertProduct(client, { priceAr: 12345 });

    const { products } = await service.listActiveProducts();

    expect(products).toMatchObject([{ priceAr: 12345 }]);
    expect(products.every((product) => Number.isInteger(product.priceAr))).toBe(true);
  });

  it("returns every column of the public shape with the value stored in it", async () => {
    const id = await insertProduct(client, {
      name: "Zebu skewers",
      description: "Grilled over charcoal",
      priceAr: 12000,
      available: true,
      imageKey: "products/zebu-skewers.jpg",
      imageAlt: "Skewers on a grill",
    });

    const { products } = await service.listActiveProducts();

    // Each value is different from the others: a swapped column (key and alt, say) is visible.
    expect(products).toEqual([
      {
        id,
        name: "Zebu skewers",
        description: "Grilled over charcoal",
        priceAr: 12000,
        available: true,
        image: { key: "products/zebu-skewers.jpg", alt: "Skewers on a grill" },
      },
    ]);
  });

  it("returns a description with surrounding spaces unchanged", async () => {
    await insertProduct(client, { description: "  padded text \n" });

    const { products } = await service.listActiveProducts();

    expect(products).toMatchObject([{ description: "  padded text \n" }]);
  });

  it("returns the availability of each product as stored", async () => {
    const availableId = await insertProduct(client, { available: true, position: 1 });
    const unavailableId = await insertProduct(client, { available: false, position: 2 });

    const { products } = await service.listActiveProducts();

    expect(products).toMatchObject([
      { id: availableId, available: true },
      { id: unavailableId, available: false },
    ]);
  });

  it("asks the database for the public columns only, whatever the mapper does afterwards", async () => {
    // Calls through to the real client: the spy only observes the arguments of the one query.
    const findMany = vi.spyOn(client.product, "findMany");

    await service.listActiveProducts();

    expect(findMany).toHaveBeenCalledOnce();
    const [query] = findMany.mock.calls[0] ?? [];
    expect(Object.keys(query?.select ?? {}).sort()).toEqual([
      "available",
      "description",
      "id",
      "imageAlt",
      "imageKey",
      "name",
      "priceAr",
    ]);
    findMany.mockRestore();
  });

  it("rejects when the database cannot be reached", async () => {
    const unreachable = createPrismaClient({
      connectionString: "postgresql://nobody:nothing@127.0.0.1:1/none",
      maxConnections: 1,
      connectionTimeoutMs: 1000,
    });

    try {
      const failure: unknown = await new CatalogService(unreachable).listActiveProducts().then(
        () => undefined,
        (error: unknown) => error,
      );

      // The driver's own failure, not wrapped by the service: the classifier recognises it.
      expect(failure).toBeInstanceOf(Error);
      expect(classifyDatabaseError(failure)).toBe("connection");
    } finally {
      await unreachable.$disconnect();
    }
  });
});
