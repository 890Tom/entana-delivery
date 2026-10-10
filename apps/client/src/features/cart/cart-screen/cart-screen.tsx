import type { ProductListResponse } from "@entana/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { Link } from "wouter";

import { BottomBar } from "../../../components/bottom-bar/bottom-bar";
import bar from "../../../components/bottom-bar/bottom-bar.module.css";
import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import { useDocumentTitle } from "../../../layout/document-title/use-document-title";
import { DELIVERY_PATH } from "../../../routes";
import { readCatalogueErrorKind } from "../../catalogue/api/fetch-products";
import { useProducts } from "../../catalogue/api/use-products";
import { useCart } from "../cart-context";
import { toDisplayLines } from "../rules/to-display-lines";
import { useCartReconciliation } from "../reconciliation/use-cart-reconciliation";

import { CartContent } from "./cart-content";
import styles from "./cart-screen.module.css";
import { CartSkeleton } from "./cart-skeleton";

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
      <CartContent lines={toDisplayLines(lines, query.data.products)} variant="screen" />
    </Card>
  );
}

export function CartScreen(): ReactElement {
  useDocumentTitle(texts.cart.screen.title);
  const query = useProducts();
  const { hasRemovedUnavailable, itemCount } = useCart();
  useCartReconciliation(query.data?.products);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.title}>{texts.cart.screen.heading}</h1>
        {hasRemovedUnavailable && <Notice tone="info">{texts.cart.removedUnavailable}</Notice>}
        <CartBody query={query} />
        {itemCount > 0 && (
          // From 1024 px the fixed bar is not displayed: this link, shown from there, replaces it.
          <div className={styles.desktopAction}>
            <Link href={DELIVERY_PATH} className={bar.link}>
              {texts.cart.screen.continue}
            </Link>
          </div>
        )}
      </div>
      {itemCount > 0 && <BottomBar href={DELIVERY_PATH} label={texts.cart.screen.continue} />}
    </div>
  );
}
