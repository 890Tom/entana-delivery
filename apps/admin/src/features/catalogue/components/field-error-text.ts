import { texts } from "../../../i18n/texts";
import type { FieldErrorKey } from "../rules/product-form";

const t = texts.catalogueForm.errors;

const ERROR_TEXT: Readonly<Record<FieldErrorKey, string>> = {
  name: t.name,
  price: t.price,
  sku: t.sku,
  imageAlt: t.imageAlt,
  skuTaken: t.skuTaken,
  imageAltRequired: t.imageAltRequired,
};

/** The words of a field error, or undefined when the field has none. */
export function fieldErrorText(key: FieldErrorKey | undefined): string | undefined {
  return key === undefined ? undefined : ERROR_TEXT[key];
}
