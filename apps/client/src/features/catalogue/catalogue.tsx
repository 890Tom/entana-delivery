import type { ProductListResponse } from "@entana/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { Notice } from "../../components/notice/notice";
import { texts } from "../../i18n/texts";
import { useCart } from "../cart/cart-context";
import { useCartReconciliation } from "../cart/use-cart-reconciliation";

import { readCatalogueErrorKind } from "./api/fetch-products";
import { useProducts } from "./api/use-products";
import styles from "./catalogue.module.css";
import { ProductCard } from "./product-card/product-card";
import { ProductGridSkeleton } from "./product-grid-skeleton/product-grid-skeleton";

function CatalogueBody({ query }: { query: UseQueryResult<ProductListResponse> }): ReactElement {
  if (query.isPending) {
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

  const { hasRemovedUnavailable } = useCart();
  useCartReconciliation(query.data?.products);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.title}>{texts.catalogue.title}</h1>
        {hasRemovedUnavailable && <Notice tone="info">{texts.cart.removedUnavailable}</Notice>}
        <CatalogueBody query={query} />
      </div>
    </div>
  );
}
