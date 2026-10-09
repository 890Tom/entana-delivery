import type { ProductListResponse, PublicProduct } from "@entana/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";

import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import { useDocumentTitle } from "../../../layout/use-document-title";
import { readCatalogueErrorKind } from "../../catalogue/api/fetch-products";
import { useProducts } from "../../catalogue/api/use-products";
import { useCart } from "../cart-context";
import type { CartLine as StoredCartLine } from "../cart-reducer";
import { useCartReconciliation } from "../use-cart-reconciliation";

import { CartContent } from "./cart-content";
import type { CartDisplayLine } from "./cart-line";
import styles from "./cart-screen.module.css";
import { CartSkeleton } from "./cart-skeleton";

/** Joins the stored quantities to the catalogue; a product that is not on sale is left out. */
function toDisplayLines(
  stored: readonly StoredCartLine[],
  products: readonly PublicProduct[],
): readonly CartDisplayLine[] {
  const onSale = new Map(products.filter((p) => p.available).map((p) => [p.id, p]));
  return stored.flatMap(({ productId, quantity }) => {
    const product = onSale.get(productId);
    return product === undefined
      ? []
      : [{ productId, name: product.name, unitPriceAr: product.priceAr, quantity }];
  });
}

function Card({ children }: { children: ReactNode }): ReactElement {
  return <div className={styles.card}>{children}</div>;
}

function CartBody({ query }: { query: UseQueryResult<ProductListResponse> }): ReactElement {
  const { lines } = useCart();
  if (query.isPending) {
    return (
      <Card>
        <CartSkeleton />
      </Card>
    );
  }
  if (query.isError) {
    return (
      <Notice
        tone="error"
        action={{
          label: texts.common.retry,
          onClick: () => {
            void query.refetch();
          },
        }}
      >
        {texts.catalogue.errors[readCatalogueErrorKind(query.error)]}
      </Notice>
    );
  }
  return (
    <Card>
      <CartContent lines={toDisplayLines(lines, query.data.products)} />
    </Card>
  );
}

export function CartScreen(): ReactElement {
  useDocumentTitle(texts.cart.screen.title);
  const query = useProducts();
  const { hasRemovedUnavailable } = useCart();
  useCartReconciliation(query.data?.products);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.title}>{texts.cart.screen.heading}</h1>
        {hasRemovedUnavailable && <Notice tone="info">{texts.cart.removedUnavailable}</Notice>}
        <CartBody query={query} />
      </div>
    </div>
  );
}
