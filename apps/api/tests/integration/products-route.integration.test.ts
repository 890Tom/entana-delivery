import { productListResponseSchema, publicProductSchema } from "@entana/contracts";
import { createPrismaClient } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { z } from "zod";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from "vitest";
import { startRealApp } from "../e2e/support/create-test-app.js";
import { buildTestConfig } from "../e2e/support/test-config.js";
import { assertThrowawayDatabase } from "./support/assert-throwaway-database.js";
import { insertProduct } from "./support/insert-product.js";

const PRODUCTS_PATH = "/api/v1/products";
const READY_PATH = "/api/v1/health/ready";
const BURST = 40;
// The default of createPrismaClient: one pool of the application may hold this many connections.
const POOL_MAXIMUM = 10;

describe("GET /api/v1/products on a real PostgreSQL", () => {
  let client: PrismaClient;
  let app: NestExpressApplication | undefined;

  beforeAll(() => {
    client = createPrismaClient({
      connectionString: inject("throwawayConnectionString"),
      maxConnections: 1,
    });
  });

  beforeEach(async () => {
    await assertThrowawayDatabase(client);
    await client.product.deleteMany();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  async function start(): Promise<NestExpressApplication> {
    const config = buildTestConfig({ DATABASE_URL: inject("throwawayConnectionString") });
    app = await startRealApp(config);
    return app;
  }

  async function get(path: string): Promise<request.Response> {
    return request((app ?? (await start())).getHttpServer()).get(path);
  }

  // Backends of closed clients disappear a moment later: the number is read until it stops moving.
  async function countSettledConnections(): Promise<number> {
    let previous = -1;
    let settled = -1;
    await vi.waitFor(
      async () => {
        const current = await countConnections();
        const isStable = current === previous;
        previous = current;
        settled = current;
        expect(isStable).toBe(true);
      },
      { timeout: 5000, interval: 200 },
    );
    return settled;
  }

  // The connections of other clients to the same database (the test's own one is left out).
  async function countConnections(): Promise<number> {
    const rows = await client.$queryRaw<
      { n: number }[]
    >`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()`;
    return rows[0]?.n ?? 0;
  }

  it("answers 200 application/json with the product list of the shared schema", async () => {
    const id = await insertProduct(client);

    const response = await get(PRODUCTS_PATH);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(productListResponseSchema.parse(response.body).products.map((p) => p.id)).toEqual([id]);
  });

  it("asks the shared caches to keep a success for 30 seconds", async () => {
    await insertProduct(client);

    const response = await get(PRODUCTS_PATH);

    expect(response.headers["cache-control"]).toBe("public, max-age=30");
  });

  it("returns exactly the keys of the contract and no sku, although the rows have one", async () => {
    await insertProduct(client, { position: 1 });
    await insertProduct(client, { position: 2, available: false });

    const response = await get(PRODUCTS_PATH);

    const { products } = z
      .object({ products: z.array(z.record(z.string(), z.unknown())) })
      .parse(response.body);
    expect(products).toHaveLength(2);
    const expectedKeys = Object.keys(publicProductSchema.shape).sort();
    for (const product of products) {
      expect(Object.keys(product).sort()).toEqual(expectedKeys);
    }
    expect(response.text).not.toContain("sku");
    expect(response.text).not.toContain("SKU-");
  });

  it("returns only the active products, in the order of position, name and id", async () => {
    const lowId = "00000000-0000-4000-8000-000000000001";
    const highId = "00000000-0000-4000-8000-000000000002";
    // Inserted in an order that differs from the expected one.
    const last = await insertProduct(client, { position: 3, name: "A" });
    const tieHigh = await insertProduct(client, { position: 2, name: "A", id: highId });
    await insertProduct(client, { position: 1, active: false });
    const byName = await insertProduct(client, { position: 2, name: "B" });
    const tieLow = await insertProduct(client, { position: 2, name: "A", id: lowId });

    const response = await get(PRODUCTS_PATH);

    const { products } = productListResponseSchema.parse(response.body);
    expect(products.map((product) => product.id)).toEqual([tieLow, tieHigh, byName, last]);
  });

  it("serialises a missing description as null and a present one as it is", async () => {
    await insertProduct(client, { position: 1, description: null });
    await insertProduct(client, { position: 2, description: "Grilled over charcoal" });

    const response = await get(PRODUCTS_PATH);

    expect(productListResponseSchema.parse(response.body).products).toMatchObject([
      { description: null },
      { description: "Grilled over charcoal" },
    ]);
  });

  it("returns an unavailable product with available false", async () => {
    const id = await insertProduct(client, { available: false });

    const response = await get(PRODUCTS_PATH);

    expect(productListResponseSchema.parse(response.body).products).toMatchObject([
      { id, available: false },
    ]);
  });

  it("returns an empty list for an empty catalogue", async () => {
    const response = await get(PRODUCTS_PATH);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ products: [] });
  });

  it("uses one pool for the catalogue and for the readiness check", async () => {
    await insertProduct(client);
    const before = await countSettledConnections();
    await start();

    await Promise.all(Array.from({ length: BURST }, () => get(PRODUCTS_PATH)));
    const afterCatalogue = (await countConnections()) - before;
    await get(READY_PATH);
    const afterReadiness = (await countConnections()) - before;

    process.stdout.write(
      `Connections opened by the application: ${String(afterCatalogue)} after ${String(BURST)} catalogue requests, ${String(afterReadiness)} after a readiness check (one pool holds at most ${String(POOL_MAXIMUM)}).\n`,
    );
    expect(afterCatalogue).toBeGreaterThan(0);
    expect(afterCatalogue).toBeLessThanOrEqual(POOL_MAXIMUM);
    // A second pool would open its own connection for the readiness check.
    expect(afterReadiness).toBe(afterCatalogue);
  });
});
