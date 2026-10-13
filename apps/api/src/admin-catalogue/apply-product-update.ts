import { planProductUpdate } from "@entana/contracts";
import type { ProductUpdatePlan, UpdateProductRequest } from "@entana/contracts";
import { ProductNotPublishableError } from "./errors/admin-catalogue-errors.js";
import {
  findLastPosition,
  insertProductAudit,
  updateProduct,
} from "./persistence/admin-product-queries.js";
import type { AdminProductDatabase, ProductAudit } from "./persistence/admin-product-queries.js";
import type { StoredAdminProduct } from "./rules/to-admin-product.js";

type ChangedPlan = Extract<ProductUpdatePlan, { kind: "changed" }>;
type Entry = Pick<ProductAudit, "action" | "diff">;

// One entry per real change, in a fixed order: the fields, the availability, the lifecycle.
function auditEntries(plan: ChangedPlan): Entry[] {
  const entries: Entry[] = [];
  if (plan.fields.length > 0) {
    entries.push({
      action: "product.updated",
      diff: {
        fields: plan.fields,
        ...(plan.price === null ? {} : { priceAr: plan.price }),
      },
    });
  }
  if (plan.availability !== null) {
    entries.push({
      action: "product.availability_changed",
      diff: { available: plan.availability },
    });
  }
  if (plan.lifecycle === "retired") {
    entries.push({ action: "product.retired", diff: { active: { from: true, to: false } } });
  }
  if (plan.lifecycle === "restored") {
    entries.push({ action: "product.restored", diff: { active: { from: false, to: true } } });
  }
  return entries;
}

/**
 * Applies a partial change to the product read as `before`, inside the caller's transaction:
 * writes only what differs, one audit entry per real change, nothing at all when no value changes.
 * A restoration goes to the end of the list and dates the availability from now. Shared by the
 * update and by the restoration route, so that both obey the same rule.
 */
export async function applyProductUpdate(
  database: AdminProductDatabase,
  before: StoredAdminProduct,
  request: UpdateProductRequest,
  context: { readonly adminId: string; readonly now: Date },
): Promise<StoredAdminProduct> {
  const plan = planProductUpdate(before, request);
  if (plan.kind === "not_publishable") {
    throw new ProductNotPublishableError();
  }
  if (plan.kind === "unchanged") {
    return before;
  }
  const isRestored = plan.lifecycle === "restored";
  const after = await updateProduct(database, before.id, {
    ...plan.columns,
    ...(isRestored ? { position: (await findLastPosition(database)) + 1 } : {}),
    ...(isRestored || plan.availability !== null ? { availabilityChangedAt: context.now } : {}),
  });
  for (const entry of auditEntries(plan)) {
    await insertProductAudit(database, {
      ...entry,
      actorId: context.adminId,
      productId: before.id,
    });
  }
  return after;
}
