import type { AdminProduct } from "@entana/contracts";

const byPosition = (left: AdminProduct, right: AdminProduct): number =>
  left.position - right.position || left.id.localeCompare(right.id);

/** The ids of the products that are not retired, in display order: what the server expects. */
export function activeIdsOf(products: readonly AdminProduct[]): readonly string[] {
  return products.filter((product) => !product.retired).map((product) => product.id);
}

/** The active products in the given order (positions renumbered), the retired ones after them. */
export function withActiveOrder(
  products: readonly AdminProduct[],
  ids: readonly string[],
): readonly AdminProduct[] {
  const active = ids.flatMap((id, position) => {
    const product = products.find((candidate) => candidate.id === id);
    return product === undefined ? [] : [{ ...product, position }];
  });
  return [...active, ...products.filter((product) => product.retired)];
}

/** The list with one product replaced by the server's version of it, in display order. */
export function replaceProduct(
  products: readonly AdminProduct[],
  product: AdminProduct,
): readonly AdminProduct[] {
  return products
    .map((current) => (current.id === product.id ? product : current))
    .sort(byPosition);
}
