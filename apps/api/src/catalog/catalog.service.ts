import { Inject, Injectable } from "@nestjs/common";
import type { ProductListResponse } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import { DATABASE_CLIENT } from "../database/database-client.js";
import { toPublicProduct } from "./to-public-product.js";

/** What the service needs from the database client: the PrismaClient fits. */
export interface CatalogDatabase {
  product: Pick<PrismaClient["product"], "findMany">;
}

@Injectable()
export class CatalogService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: CatalogDatabase) {}

  /** The active products in display order. Database errors propagate unchanged. */
  async listActiveProducts(): Promise<ProductListResponse> {
    const rows = await this.database.product.findMany({
      where: { active: true },
      // An explicit allow-list: sku, position, active and availabilityChangedAt are never read.
      select: {
        id: true,
        name: true,
        description: true,
        priceAr: true,
        available: true,
        imageKey: true,
        imageAlt: true,
      },
      // The id makes the order total: two products with the same position and name never swap.
      orderBy: [{ position: "asc" }, { name: "asc" }, { id: "asc" }],
    });
    return { products: rows.map(toPublicProduct) };
  }
}
