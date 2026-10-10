import { computeOrderTotal } from "@entana/contracts";
import type { ProductListResponse } from "@entana/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";

import { OrderSummary } from "../../components/order-summary/order-summary";
import type {
  OrderSummaryContent,
  OrderSummaryTitle,
} from "../../components/order-summary/order-summary";
import { texts } from "../../i18n/texts";
import { readCatalogueErrorKind } from "../catalogue/api/fetch-products";
import { useProducts } from "../catalogue/api/use-products";
import { useCart } from "../cart/cart-state/cart-context";
import type { CartLine } from "../cart/rules/cart-reducer";
import { toDisplayLines } from "../cart/rules/to-display-lines";
import { estimateDeliveryFee } from "../delivery/rules/estimate-delivery-fee";

function toContent(
  query: UseQueryResult<ProductListResponse>,
  cartLines: readonly CartLine[],
): OrderSummaryContent {
  if (query.isPending) {
    return { status: "loading" };
  }
  if (query.isError) {
    return {
      status: "failed",
      message: texts.catalogue.errors[readCatalogueErrorKind(query.error)],
      onRetry: () => {
        void query.refetch();
      },
    };
  }
  // Prices come from the catalogue, never from the storage; a product no longer on sale is left
  // out. With nothing left there is nothing to add up.
  const lines = toDisplayLines(cartLines, query.data.products);
  if (lines.length === 0) {
    return { status: "empty" };
  }
  const deliveryFeeAr = estimateDeliveryFee();
  return {
    status: "ready",
    lines: lines.map((line) => ({
      id: line.productId,
      name: line.name,
      quantity: line.quantity,
      amountAr: line.unitPriceAr * line.quantity,
    })),
    deliveryFeeAr,
    // A display only: the server recomputes the total when the order is placed.
    totalAr: computeOrderTotal(
      lines.map((line) => ({ unitPrice: line.unitPriceAr, quantity: line.quantity })),
      deliveryFeeAr,
    ),
  };
}

/**
 * The summary of the customer's cart, priced by the catalogue. The screens of the order that show
 * it put their own notice and primary button in `children`.
 */
export function OrderSummaryCard({
  title,
  children,
}: {
  title?: OrderSummaryTitle;
  children?: ReactNode;
}): ReactElement {
  const query = useProducts();
  const { lines } = useCart();
  return (
    <OrderSummary content={toContent(query, lines)} title={title}>
      {children}
    </OrderSummary>
  );
}
