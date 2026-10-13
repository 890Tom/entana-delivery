import { createProductRequestSchema } from "@entana/contracts";
import type { AdminProduct } from "@entana/contracts";

import { groupThousands } from "../../../order-display/format-order";

export interface ProductFormValues {
  readonly name: string;
  /** The digits typed, with no group separator. */
  readonly price: string;
  readonly sku: string;
  readonly description: string;
  readonly imageAlt: string;
  readonly isAvailable: boolean;
  /** Visible in the catalogue: the negation of "retired". */
  readonly isVisible: boolean;
}

export type ProductFormField = "name" | "price" | "sku" | "description" | "imageAlt";

/** The kinds of error a field shows; the words are in the texts. */
export type FieldErrorKey = "name" | "price" | "sku" | "imageAlt" | "skuTaken" | "imageAltRequired";

export type ProductFormErrors = Partial<Record<ProductFormField, FieldErrorKey>>;

/** The fields in the order of the page: the first one in error takes the focus. */
export const FORM_FIELD_ORDER: readonly ProductFormField[] = [
  "imageAlt",
  "name",
  "price",
  "sku",
  "description",
];

/** The price is typed in digits: at most seven, which is the width of the highest price. */
const PRICE_MAX_DIGITS = 7;

export function emptyProductForm(): ProductFormValues {
  return {
    name: "",
    price: "",
    sku: "",
    description: "",
    imageAlt: "",
    isAvailable: true,
    isVisible: false,
  };
}

export function formValuesOf(product: AdminProduct): ProductFormValues {
  return {
    name: product.name,
    price: String(product.priceAr),
    sku: product.sku,
    description: product.description ?? "",
    imageAlt: product.imageAlt ?? "",
    isAvailable: product.available,
    isVisible: !product.retired,
  };
}

/** What a price field keeps of a typed or pasted text: digits only, within the width. */
export function readPriceInput(text: string): string {
  return text.replace(/\D/g, "").slice(0, PRICE_MAX_DIGITS);
}

/** The price as it is shown in the field: grouped by three with no-break spaces. */
export function showPriceInput(digits: string): string {
  return groupThousands(digits);
}

/** The references are written in capitals, as the server keeps them. */
export function readSkuInput(text: string): string {
  return text.toUpperCase();
}

/** The field a schema issue names (by the path of the request); the lengths have no entry. */
const FIELD_OF_ISSUE: Readonly<Record<string, "name" | "price" | "sku" | "imageAlt" | undefined>> =
  {
    name: "name",
    priceAr: "price",
    sku: "sku",
    imageAlt: "imageAlt",
  };

/**
 * The refused fields of a form, by the shared creation schema. The lengths are capped by the
 * fields themselves (a text longer than its limit cannot be typed), so only the others have a
 * message. The alternative text is obligatory as soon as a photo exists or is chosen.
 */
export function validateProductForm(
  values: ProductFormValues,
  hasPhoto: boolean,
): ProductFormErrors {
  const parsed = createProductRequestSchema.safeParse({
    name: values.name,
    priceAr: values.price === "" ? Number.NaN : Number(values.price),
    sku: values.sku,
    description: values.description,
    ...(values.imageAlt.trim() === "" ? {} : { imageAlt: values.imageAlt }),
    available: values.isAvailable,
  });
  const errors: Partial<Record<ProductFormField, FieldErrorKey>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = FIELD_OF_ISSUE[String(issue.path[0])];
      if (field !== undefined) {
        errors[field] = field;
      }
    }
  }
  if (hasPhoto && values.imageAlt.trim() === "") {
    errors.imageAlt = "imageAlt";
  }
  return errors;
}

/** Whether the product can be published: a photo (kept or chosen) and its alternative text. */
export function canPublish(values: ProductFormValues, hasPhoto: boolean): boolean {
  return hasPhoto && values.imageAlt.trim() !== "";
}

export interface CreateBody {
  readonly name: string;
  readonly priceAr: number;
  readonly sku: string;
  readonly description?: string;
  readonly imageAlt?: string;
  readonly available: boolean;
}

/** The fields to change: only those that differ from the product. */
export interface UpdateBody {
  readonly name?: string;
  readonly priceAr?: number;
  readonly sku?: string;
  readonly description?: string;
  readonly imageAlt?: string;
  readonly available?: boolean;
}

export function buildCreateBody(values: ProductFormValues): CreateBody {
  const description = values.description.trim();
  const imageAlt = values.imageAlt.trim();
  return {
    name: values.name.trim(),
    priceAr: Number(values.price),
    sku: values.sku.trim().toUpperCase(),
    ...(description === "" ? {} : { description }),
    ...(imageAlt === "" ? {} : { imageAlt }),
    available: values.isAvailable,
  };
}

/** The field with its new value, or nothing when the value is the product's own. */
function changed<Key extends keyof UpdateBody>(
  key: Key,
  next: UpdateBody[Key],
  current: unknown,
): UpdateBody {
  return next === undefined || next === current ? {} : { [key]: next };
}

/**
 * The body of the change, or null when the form changes nothing but the visibility. An empty
 * description clears it; an empty alternative text is never sent (the server refuses it, and the
 * form refuses it once a photo exists).
 */
export function buildUpdateBody(
  values: ProductFormValues,
  product: AdminProduct,
): UpdateBody | null {
  const created = buildCreateBody(values);
  const body: UpdateBody = {
    ...changed("name", created.name, product.name),
    ...changed("priceAr", created.priceAr, product.priceAr),
    ...changed("sku", created.sku, product.sku),
    ...changed("description", values.description.trim(), product.description ?? ""),
    ...changed("imageAlt", created.imageAlt, product.imageAlt ?? ""),
    ...changed("available", created.available, product.available),
  };
  return Object.keys(body).length === 0 ? null : body;
}

/** The change of visibility to send last, or null when it is the one the server has. */
export function planVisibilityChange(
  values: ProductFormValues,
  product: AdminProduct | null,
): { readonly retired: boolean } | null {
  if (product === null) {
    return values.isVisible ? { retired: false } : null;
  }
  return values.isVisible === !product.retired ? null : { retired: !values.isVisible };
}
