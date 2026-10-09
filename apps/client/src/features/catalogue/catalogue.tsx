import type { ProductListResponse } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { Notice } from "../../components/notice/notice";
import { texts } from "../../i18n/texts";

import { CatalogueError, fetchProducts } from "./api/fetch-products";
import type { CatalogueErrorKind } from "./api/fetch-products";
import styles from "./catalogue.module.css";
import { ProductCard } from "./product-card/product-card";
import { ProductGridSkeleton } from "./product-grid-skeleton/product-grid-skeleton";

function readErrorKind(error: unknown): CatalogueErrorKind {
  return error instanceof CatalogueError ? error.kind : "unexpected";
}

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
        {texts.catalogue.errors[readErrorKind(query.error)]}
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
  const query = useQuery({
    queryKey: ["products"],
    queryFn: ({ signal }) => fetchProducts(signal),
  });

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.title}>{texts.catalogue.title}</h1>
        <CatalogueBody query={query} />
      </div>
    </main>
  );
}
