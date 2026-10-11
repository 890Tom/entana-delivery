import type { ProductListResponse } from "@entana/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { Notice } from "../../components/notice/notice";
import { texts } from "../../i18n/texts";
import { ActiveOrderNotice } from "../active-order/notice/active-order-notice";
import { useLaunch } from "../active-order/launch/launch-context";
import { useCart } from "../cart/cart-state/cart-context";
import { useCartReconciliation } from "../cart/reconciliation/use-cart-reconciliation";

import { readCatalogueErrorKind } from "./api/fetch-products";
import { useProducts } from "./api/use-products";
import { CatalogueBottomBar } from "./bottom-bar/catalogue-bottom-bar";
import styles from "./catalogue.module.css";
import { ProductCard } from "./product-card/product-card";
import { ProductGridSkeleton } from "./product-grid-skeleton/product-grid-skeleton";

interface CatalogueBodyProps {
  readonly query: UseQueryResult<ProductListResponse>;
  /** The opening of the application is being checked: the loading state stays. */
  readonly isHeld: boolean;
}

function CatalogueBody({ query, isHeld }: CatalogueBodyProps): ReactElement {
  if (query.isPending || isHeld) {
    return <ProductGridSkeleton />;
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
  if (query.data.products.length === 0) {
    return <Notice tone="info">{texts.catalogue.empty}</Notice>;
  }
  return (
    <ul className={styles.grid}>
      {query.data.products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

export function Catalogue(): ReactElement {
  const query = useProducts();
  const { isHolding } = useLaunch();

  const { hasRemovedUnavailable } = useCart();
  useCartReconciliation(query.data?.products);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.title}>{texts.catalogue.title}</h1>
        <ActiveOrderNotice />
        {hasRemovedUnavailable && <Notice tone="info">{texts.cart.removedUnavailable}</Notice>}
        <CatalogueBody query={query} isHeld={isHolding} />
      </div>
      <CatalogueBottomBar query={query} />
    </div>
  );
}
