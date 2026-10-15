import type { ProductListResponse } from "@entana/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import { useId } from "react";
import type { ReactElement } from "react";
import { Link } from "wouter";

import bar from "../../../components/bottom-bar/bottom-bar.module.css";
import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import { DELIVERY_PATH } from "../../../routes";
import { readCatalogueErrorKind } from "../../catalogue/api/fetch-products";
import { useProducts } from "../../catalogue/api/use-products";
import { useCart } from "../cart-state/cart-context";
import { CartContent } from "../cart-content/cart-content";
import { CartSkeleton } from "../cart-content/cart-skeleton";
import { toDisplayLines } from "../rules/to-display-lines";

import styles from "./cart-panel.module.css";

function PanelBody({ query }: { query: UseQueryResult<ProductListResponse> }): ReactElement {
  const { lines } = useCart();
  if (query.isPending) {
    return (
      <div className={styles.lines}>
        <CartSkeleton />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Notice
        tone="error"
        // The catalogue, beside the panel, shows and announces the same failure.
        isAnnounced={false}
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
  const displayLines = toDisplayLines(lines, query.data.products);
  // The first line sits against the title: its own padding is the space, so the gap is not doubled.
  return (
    <div className={displayLines.length > 0 ? styles.lines : undefined}>
      <CartContent lines={displayLines} variant="panel" />
    </div>
  );
}

/**
 * The cart beside the catalogue on the web layout. Removed from the page (not only hidden) under
 * 1024 px, so that the cart screen and the card steppers are the only ones a phone user meets.
 */
export function CartPanel(): ReactElement {
  const titleId = useId();
  const query = useProducts();
  const { itemCount } = useCart();
  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {texts.cart.panel.title}
      </h2>
      <PanelBody query={query} />
      {itemCount > 0 && (
        <>
          <Link href={DELIVERY_PATH} className={bar.link}>
            {texts.cart.screen.continue}
          </Link>
          <p className={styles.noAccount}>{texts.cart.panel.noAccount}</p>
        </>
      )}
    </aside>
  );
}
