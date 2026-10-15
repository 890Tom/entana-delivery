import type { UpdateProductRequest } from "./product-form.js";

/** The columns of a product that a change of the form reads. */
export interface ProductState {
  readonly name: string;
  readonly sku: string;
  readonly priceAr: number;
  readonly description: string | null;
  readonly imageAlt: string | null;
  readonly imageKey: string | null;
  readonly available: boolean;
  readonly active: boolean;
}

/** The names of the request fields that are audited as an update (not available, not retired). */
export type UpdatedField = "name" | "sku" | "priceAr" | "description" | "imageAlt";

/** The values to write: only the columns that differ (a restoration always rewrites `available`). */
export interface ProductColumnChanges {
  readonly name?: string;
  readonly sku?: string;
  readonly priceAr?: number;
  readonly description?: string | null;
  readonly imageAlt?: string | null;
  readonly available?: boolean;
  readonly active?: boolean;
}

export type ProductUpdatePlan =
  | { readonly kind: "unchanged" }
  /** The request would make the product visible, and it has no photo or no alternative text. */
  | { readonly kind: "not_publishable" }
  | {
      readonly kind: "changed";
      readonly columns: ProductColumnChanges;
      readonly fields: readonly UpdatedField[];
      readonly price: { readonly from: number; readonly to: number } | null;
      /** The value of `available` before and after, when it really changes. */
      readonly availability: { readonly from: boolean; readonly to: boolean } | null;
      readonly lifecycle: "retired" | "restored" | null;
    };

const UPDATED_FIELDS = ["name", "sku", "priceAr", "description", "imageAlt"] as const;

function changedFields(before: ProductState, request: UpdateProductRequest): UpdatedField[] {
  return UPDATED_FIELDS.filter((field) => {
    const value = request[field];
    return value !== undefined && value !== before[field];
  });
}

type Lifecycle = "retired" | "restored" | null;

function lifecycleOf(before: ProductState, request: UpdateProductRequest): Lifecycle {
  if (request.retired === undefined || request.retired === !before.active) {
    return null;
  }
  return request.retired ? "retired" : "restored";
}

// A restoration makes the product unavailable unless the same request says otherwise.
function availabilityAfter(
  before: ProductState,
  request: UpdateProductRequest,
  lifecycle: Lifecycle,
): boolean {
  if (request.available !== undefined) {
    return request.available;
  }
  return lifecycle === "restored" ? false : before.available;
}

function isMadeVisibleWithoutPhoto(
  before: ProductState,
  request: UpdateProductRequest,
  lifecycle: Lifecycle,
): boolean {
  const isVisible = lifecycle === "restored" || (lifecycle === null && before.active);
  return isVisible && (before.imageKey === null || (request.imageAlt ?? before.imageAlt) === null);
}

function priceChange(before: ProductState, request: UpdateProductRequest): ChangedPlan["price"] {
  const { priceAr } = request;
  return priceAr === undefined || priceAr === before.priceAr
    ? null
    : { from: before.priceAr, to: priceAr };
}

type ChangedPlan = Extract<ProductUpdatePlan, { kind: "changed" }>;

/**
 * What a partial change does to a product, decided from the state read and the request. Pure:
 * the service writes the plan, audits it, and adds the position and the date of a restoration.
 */
export function planProductUpdate(
  before: ProductState,
  request: UpdateProductRequest,
): ProductUpdatePlan {
  const lifecycle = lifecycleOf(before, request);
  if (isMadeVisibleWithoutPhoto(before, request, lifecycle)) {
    return { kind: "not_publishable" };
  }
  const fields = changedFields(before, request);
  const isAvailable = availabilityAfter(before, request, lifecycle);
  const availability =
    isAvailable === before.available ? null : { from: before.available, to: isAvailable };
  if (fields.length === 0 && availability === null && lifecycle === null) {
    return { kind: "unchanged" };
  }
  const columns: ProductColumnChanges = {
    ...Object.fromEntries(fields.map((field) => [field, request[field]])),
    // A restoration rewrites `available` even to the same value (its date is renewed).
    ...(availability === null && lifecycle !== "restored" ? {} : { available: isAvailable }),
    ...(lifecycle === null ? {} : { active: lifecycle === "restored" }),
  };
  return {
    kind: "changed",
    columns,
    fields,
    price: priceChange(before, request),
    availability,
    lifecycle,
  };
}
