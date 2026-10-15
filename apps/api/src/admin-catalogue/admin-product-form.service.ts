import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AdminProduct, CreateProductRequest, UpdateProductRequest } from "@entana/contracts";
import { classifyDatabaseError } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import { CLOCK } from "../clock/clock.js";
import type { Clock } from "../clock/clock.js";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { MEDIA_ROOT } from "../media/media-root/media-root.token.js";
import { applyProductUpdate } from "./persistence/apply-product-update.js";
import { PhotoAltRequiredError, SkuTakenError } from "./errors/admin-catalogue-errors.js";
import { processProductPhoto } from "./photo/process-product-photo.js";
import { removeProductPhoto, writeProductPhoto } from "./photo/product-photo-files.js";
import {
  countProductsWithImageKey,
  findLastPosition,
  insertProduct,
  insertProductAudit,
  updateProduct,
} from "./persistence/admin-product-queries.js";
import { parseProductId, requireProduct } from "./lookup/product-lookup.js";
import { toAdminProduct } from "./rules/to-admin-product.js";

export type AdminProductFormClient = Pick<PrismaClient, "$transaction" | "product" | "auditLog">;

// The only unique constraint besides the primary key (a generated id) is the sku.
async function refuseTakenSku<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw classifyDatabaseError(error) === "unique_violation" ? new SkuTakenError() : error;
  }
}

@Injectable()
export class AdminProductFormService {
  private readonly logger = new Logger(AdminProductFormService.name);

  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: AdminProductFormClient,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(MEDIA_ROOT) private readonly mediaRoot: string,
  ) {}

  /** Adds a retired product at the end of the list: it has no photo, so it cannot be visible yet. */
  async create(request: CreateProductRequest, adminId: string): Promise<AdminProduct> {
    const now = this.clock.now();
    return refuseTakenSku(() =>
      this.database.$transaction(async (transaction) => {
        const created = await insertProduct(transaction, {
          name: request.name,
          sku: request.sku,
          priceAr: request.priceAr,
          description: request.description ?? null,
          imageAlt: request.imageAlt ?? null,
          available: request.available,
          active: false,
          position: (await findLastPosition(transaction)) + 1,
          availabilityChangedAt: now,
        });
        await insertProductAudit(transaction, {
          actorId: adminId,
          action: "product.created",
          productId: created.id,
          diff: { available: request.available },
        });
        return toAdminProduct(created);
      }),
    );
  }

  async update(id: string, request: UpdateProductRequest, adminId: string): Promise<AdminProduct> {
    const productId = parseProductId(id);
    const now = this.clock.now();
    return refuseTakenSku(() =>
      this.database.$transaction(async (transaction) => {
        const before = await requireProduct(transaction, productId);
        const after = await applyProductUpdate(transaction, before, request, { adminId, now });
        return toAdminProduct(after);
      }),
    );
  }

  /**
   * Replaces the photo: the new file is written first, the database is updated, and the old file
   * is removed after the commit (best effort, and only when no other product uses it). A failed
   * transaction removes the new file, so no orphan stays.
   */
  async replacePhoto(id: string, upload: Buffer, adminId: string): Promise<AdminProduct> {
    const productId = parseProductId(id);
    const current = await requireProduct(this.database, productId);
    if (current.imageAlt === null) {
      throw new PhotoAltRequiredError();
    }
    const key = await writeProductPhoto(this.mediaRoot, await processProductPhoto(upload));
    try {
      const { product, replacedKey } = await this.database.$transaction(async (transaction) => {
        const before = await requireProduct(transaction, productId);
        const after = await updateProduct(transaction, productId, { imageKey: key });
        await insertProductAudit(transaction, {
          actorId: adminId,
          action: "product.photo_replaced",
          productId,
          diff: { hadPhoto: before.imageKey !== null },
        });
        return { product: toAdminProduct(after), replacedKey: before.imageKey };
      });
      await this.removeIfUnused(replacedKey);
      return product;
    } catch (error) {
      await this.discard(key);
      throw error;
    }
  }

  private async removeIfUnused(key: string | null): Promise<void> {
    if (key === null) {
      return;
    }
    try {
      if ((await countProductsWithImageKey(this.database, key)) === 0) {
        await this.discard(key);
      }
    } catch {
      this.logWarning();
    }
  }

  private async discard(key: string): Promise<void> {
    if (!(await removeProductPhoto(this.mediaRoot, key))) {
      this.logWarning();
    }
  }

  // The write is committed or refused already: a file left behind is a leak of disk, not an error
  // to answer. The message holds no name, key or path.
  private logWarning(): void {
    this.logger.warn("A product photo file could not be removed.");
  }
}
