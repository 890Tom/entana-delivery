import type { PublicProduct } from "@entana/contracts";

import type { CartLine as StoredCartLine } from "./cart-reducer";
import type { CartDisplayLine } from "./cart-screen/cart-line";

/** Joins the stored quantities to the catalogue; a product that is not on sale is left out. */
export function toDisplayLines(
  stored: readonly StoredCartLine[],
  products: readonly PublicProduct[],
): readonly CartDisplayLine[] {
  const onSale = new Map(products.filter((p) => p.available).map((p) => [p.id, p]));
  return stored.flatMap(({ productId, quantity }) => {
    const product = onSale.get(productId);
    return product === undefined
      ? []
      : [
          {
            productId,
            name: product.name,
            unitPriceAr: product.priceAr,
            quantity,
            imageUrl: product.image.url,
          },
        ];
  });
}
