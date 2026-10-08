import type { CreateOrderRequest } from "@entana/contracts";

export interface OrderableProduct {
  readonly id: string;
  readonly name: string;
  readonly priceAr: number;
  readonly active: boolean;
  readonly available: boolean;
}

/** A line as it is frozen on the order: the name and the price come from the database. */
export interface OrderLine {
  readonly productId: string;
  readonly productName: string;
  readonly unitPrice: number;
  readonly quantity: number;
}

export type LineResolution =
  | { readonly kind: "resolved"; readonly lines: readonly OrderLine[] }
  | { readonly kind: "unusable"; readonly productIds: readonly string[] };

const isOrderable = (product: OrderableProduct | undefined): product is OrderableProduct => {
  return product !== undefined && product.active && product.available;
};

/**
 * Matches the requested items with the products read from the database. A product that is
 * unknown, inactive or unavailable makes the whole request unusable; the result then lists the ids
 * as the client sent them, in the order of the request, and nothing else about the products.
 * Pure: a uuid is compared in lower case because it is accepted in both cases.
 */
export function resolveOrderLines(
  items: CreateOrderRequest["items"],
  products: readonly OrderableProduct[],
): LineResolution {
  const byId = new Map(products.map((product) => [product.id.toLowerCase(), product]));
  const lines: OrderLine[] = [];
  const unusable: string[] = [];
  for (const item of items) {
    const product = byId.get(item.productId.toLowerCase());
    if (isOrderable(product)) {
      lines.push({
        productId: product.id,
        productName: product.name,
        unitPrice: product.priceAr,
        quantity: item.quantity,
      });
    } else {
      unusable.push(item.productId);
    }
  }
  return unusable.length > 0
    ? { kind: "unusable", productIds: unusable }
    : { kind: "resolved", lines };
}
