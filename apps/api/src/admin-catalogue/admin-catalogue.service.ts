import { Inject, Injectable } from "@nestjs/common";
import { isCompleteProductOrder } from "@entana/contracts";
import type {
  AdminProduct,
  AdminProductListResponse,
  AvailabilityRequest,
  ProductOrderRequest,
} from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import { z } from "zod";
import { CLOCK } from "../clock/clock.js";
import type { Clock } from "../clock/clock.js";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import {
  AdminProductNotFoundError,
  ProductOrderMismatchError,
  ProductRetiredError,
  ProductWithoutPhotoError,
} from "./errors/admin-catalogue-errors.js";
import {
  findActiveProductIds,
  findLastPosition,
  findProduct,
  insertProductAudit,
  listProducts,
  restoreIfPossible,
  retireIfActive,
  setAvailabilityIfActive,
  setPosition,
} from "./persistence/admin-product-queries.js";
import type { AdminProductDatabase, ProductAudit } from "./persistence/admin-product-queries.js";
import { toAdminProduct } from "./rules/to-admin-product.js";
import type { StoredAdminProduct } from "./rules/to-admin-product.js";

/** What the service needs from the database client: the PrismaClient fits. */
export type AdminCatalogueClient = Pick<PrismaClient, "$transaction" | "product" | "auditLog">;

const productIdSchema = z.uuid();

@Injectable()
export class AdminCatalogueService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: AdminCatalogueClient,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async listProducts(): Promise<AdminProductListResponse> {
    return toList(await listProducts(this.database));
  }

  /**
   * Sets the availability of an active product. The same value changes nothing and writes no
   * audit entry; a retired product is refused.
   */
  async changeAvailability(
    id: string,
    request: AvailabilityRequest,
    adminId: string,
  ): Promise<AdminProduct> {
    const productId = parseProductId(id);
    const now = this.clock.now();
    return this.database.$transaction(async (transaction) => {
      const isChanged = await setAvailabilityIfActive(
        transaction,
        productId,
        request.available,
        now,
      );
      if (isChanged) {
        await insertProductAudit(transaction, {
          actorId: adminId,
          action: "product.availability_changed",
          productId,
          diff: { available: { from: !request.available, to: request.available } },
        });
      }
      const product = await requireProduct(transaction, productId);
      if (!isChanged && !product.active) {
        throw new ProductRetiredError();
      }
      return toAdminProduct(product);
    });
  }

  /** Retires an active product (soft: the orders keep their lines). Already retired: unchanged. */
  async retire(id: string, adminId: string): Promise<AdminProduct> {
    const productId = parseProductId(id);
    return this.database.$transaction(async (transaction) => {
      const isChanged = await retireIfActive(transaction, productId);
      await auditIf(isChanged, transaction, {
        actorId: adminId,
        action: "product.retired",
        productId,
        diff: { active: { from: true, to: false } },
      });
      return toAdminProduct(await requireProduct(transaction, productId));
    });
  }

  /**
   * Restores a retired product: active, unavailable, at the end of the list. Already active:
   * unchanged. A product without photo cannot be visible, so it stays retired and the answer is 409.
   */
  async restore(id: string, adminId: string): Promise<AdminProduct> {
    const productId = parseProductId(id);
    const now = this.clock.now();
    return this.database.$transaction(async (transaction) => {
      const position = (await findLastPosition(transaction)) + 1;
      const isChanged = await restoreIfPossible(transaction, { id: productId, position, now });
      await auditIf(isChanged, transaction, {
        actorId: adminId,
        action: "product.restored",
        productId,
        diff: { active: { from: false, to: true } },
      });
      const product = await requireProduct(transaction, productId);
      if (!isChanged && !product.active) {
        throw new ProductWithoutPhotoError();
      }
      return toAdminProduct(product);
    });
  }

  /**
   * Writes the positions 0 to n-1 of the products that are not retired. The list must be exactly
   * that set: otherwise nothing is written. The order is not audited.
   */
  async reorder(request: ProductOrderRequest): Promise<AdminProductListResponse> {
    return this.database.$transaction(async (transaction) => {
      const activeIds = await findActiveProductIds(transaction);
      if (!isCompleteProductOrder(request.ids, activeIds)) {
        throw new ProductOrderMismatchError();
      }
      for (const [position, id] of request.ids.entries()) {
        await setPosition(transaction, id, position);
      }
      return toList(await listProducts(transaction));
    });
  }
}

const toList = (rows: readonly StoredAdminProduct[]): AdminProductListResponse => ({
  products: rows.map(toAdminProduct),
});

async function auditIf(
  isChanged: boolean,
  database: AdminProductDatabase,
  audit: ProductAudit,
): Promise<void> {
  if (isChanged) {
    await insertProductAudit(database, audit);
  }
}

async function requireProduct(
  database: AdminProductDatabase,
  id: string,
): Promise<StoredAdminProduct> {
  const product = await findProduct(database, id);
  if (product === null) {
    throw new AdminProductNotFoundError();
  }
  return product;
}

// A malformed id is the same "not found" as an unknown one, and never reaches the database (a
// uuid column refuses a text that is not one).
function parseProductId(id: string): string {
  const parsed = productIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new AdminProductNotFoundError();
  }
  return parsed.data;
}
