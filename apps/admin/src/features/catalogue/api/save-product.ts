import type { AdminProduct } from "@entana/contracts";

import type { AdminFailure, AdminResult } from "../../../data-fetching/fetch-admin";
import { buildCreateBody, buildUpdateBody, planVisibilityChange } from "../rules/product-form";
import type { ProductFormValues } from "../rules/product-form";

import { patchProduct, postProduct, putProductPhoto } from "./catalogue-calls";

export interface SaveRequest {
  /** The product being changed; null for a new one. */
  readonly product: AdminProduct | null;
  readonly values: ProductFormValues;
  /** The photo chosen and not sent yet. */
  readonly photo: File | null;
}

/** The step that was refused: the details, the photo, or the publication. */
type SaveStage = "details" | "photo" | "publish";

export type SaveOutcome =
  | { readonly kind: "saved"; readonly product: AdminProduct }
  | {
      readonly kind: "failed";
      readonly stage: SaveStage;
      readonly failure: AdminFailure;
      /** The last version of the product the server gave, if the product exists now. */
      readonly product: AdminProduct | null;
      /** Whether this save created the product (it exists, and the page is still the new form). */
      readonly isCreation: boolean;
    };

type Step =
  | { readonly ok: true; readonly product: AdminProduct }
  | { readonly ok: false; readonly failure: AdminFailure };

function toStep(result: AdminResult<AdminProduct>): Step {
  return result.kind === "ok" ? { ok: true, product: result.data } : { ok: false, failure: result };
}

/** The first step: a creation, or the change of the fields that differ (none: nothing is sent). */
async function sendDetails(request: SaveRequest): Promise<Step> {
  const { product, values } = request;
  if (product === null) {
    return toStep(await postProduct(buildCreateBody(values)));
  }
  const body = buildUpdateBody(values, product);
  return body === null ? { ok: true, product } : toStep(await patchProduct(product.id, body));
}

/**
 * Saves a product in three steps, in this order: the details (a creation or a change of the
 * fields that differ), the photo if one was chosen, and the visibility if it differs from the
 * server's. The first refusal stops the sequence; what the earlier steps wrote stays written.
 */
export async function saveProduct(request: SaveRequest): Promise<SaveOutcome> {
  const isCreation = request.product === null;
  const details = await sendDetails(request);
  if (!details.ok) {
    return {
      kind: "failed",
      stage: "details",
      failure: details.failure,
      product: request.product,
      isCreation: false,
    };
  }
  let current = details.product;
  if (request.photo !== null) {
    const photo = await putProductPhoto(current.id, request.photo);
    if (photo.kind !== "ok") {
      return { kind: "failed", stage: "photo", failure: photo, product: current, isCreation };
    }
    current = photo.data;
  }
  const visibility = planVisibilityChange(request.values, request.product);
  if (visibility !== null) {
    const published = await patchProduct(current.id, visibility);
    if (published.kind !== "ok") {
      return { kind: "failed", stage: "publish", failure: published, product: current, isCreation };
    }
    current = published.data;
  }
  return { kind: "saved", product: current };
}
