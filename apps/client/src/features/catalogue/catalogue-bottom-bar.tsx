import { computeOrderTotal, formatAmount } from "@entana/contracts";
import type { ProductListResponse } from "@entana/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { BottomBar } from "../../components/bottom-bar/bottom-bar";
import type { BottomBarAmount } from "../../components/bottom-bar/bottom-bar";
import { texts } from "../../i18n/texts";
import { CART_PATH } from "../../routes";
import { useCart } from "../cart/cart-context";
import { toDisplayLines } from "../cart/to-display-lines";

function readAmount(
  query: UseQueryResult<ProductListResponse>,
  lines: ReturnType<typeof useCart>["lines"],
): BottomBarAmount | undefined {
  if (query.isPending) {
    return { status: "loading" };
  }
  if (query.isError) {
    return undefined;
  }
  const priced = toDisplayLines(lines, query.data.products);
  if (priced.length === 0) {
    return undefined;
  }
  // A display only: the server recomputes the total when the order is placed.
  const total = computeOrderTotal(
    priced.map((line) => ({ unitPrice: line.unitPriceAr, quantity: line.quantity })),
    0,
  );
  return { status: "ready", text: formatAmount(total) };
}

/** The link to the cart with the total of the cart; nothing while the cart is empty. */
export function CatalogueBottomBar({
  query,
}: {
  query: UseQueryResult<ProductListResponse>;
}): ReactElement | null {
  const { lines, itemCount } = useCart();
  if (itemCount === 0) {
    return null;
  }
  return (
    <BottomBar
      href={CART_PATH}
      label={texts.catalogue.viewCart}
      amount={readAmount(query, lines)}
    />
  );
}
