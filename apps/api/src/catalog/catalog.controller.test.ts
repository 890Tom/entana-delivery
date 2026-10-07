import { describe, expect, it } from "vitest";
import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";
import type { CatalogDatabase } from "./catalog.service.js";
import type { CatalogRow } from "./to-public-product.js";

// Only the client is replaced, since a Prisma delegate cannot exist without a database: the service
// and the mapper are the real ones. The cast is at that boundary, and the rows are what the test gives.
function serviceReading(rows: readonly CatalogRow[]): CatalogService {
  const database = { product: { findMany: () => Promise.resolve(rows) } };
  return new CatalogService(database as unknown as CatalogDatabase);
}

describe("CatalogController", () => {
  it("returns the public products the service builds from the rows, and nothing else", async () => {
    const service = serviceReading([
      {
        id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
        name: "Zebu skewers",
        description: null,
        priceAr: 12000,
        available: true,
        imageKey: "products/zebu.jpg",
        imageAlt: "Skewers",
      },
    ]);

    const answer = await new CatalogController(service).list();

    expect(answer).toEqual({
      products: [
        {
          id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
          name: "Zebu skewers",
          description: null,
          priceAr: 12000,
          available: true,
          image: { key: "products/zebu.jpg", alt: "Skewers" },
        },
      ],
    });
  });
});
