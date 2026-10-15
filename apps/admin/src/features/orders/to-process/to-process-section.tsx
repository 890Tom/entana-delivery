import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import type { OrderPages } from "../api/use-order-pages";

import { LoadMoreButton } from "./load-more-button";
import { OrderCard } from "./order-card";
import styles from "./to-process-section.module.css";

const PAGE_SIZE = 3;

/** The orders waiting for an answer, three cards a page. The day never narrows this section. */
export function ToProcessSection({
  pages,
  countryCode,
  hasFilter,
}: {
  pages: OrderPages;
  countryCode: string | null;
  hasFilter: boolean;
}): ReactElement {
  const remaining = Math.max(0, pages.totalCount - pages.items.length);
  return (
    <section className={styles.section} aria-labelledby="orders-to-process-title">
      <h2 id="orders-to-process-title" className={styles.title}>
        {texts.orders.toProcessTitle}
        <span className={styles.count}>{pages.totalCount}</span>
      </h2>
      {pages.items.length === 0 && !pages.isPending && (
        <p>{hasFilter ? texts.orders.noMatch : texts.orders.allHandled}</p>
      )}
      <ul className={styles.grid}>
        {pages.items.map((order) => (
          <OrderCard key={order.id} order={order} countryCode={countryCode} />
        ))}
      </ul>
      {pages.hasNextPage && (
        <LoadMoreButton
          label={texts.orders.showMore(Math.min(PAGE_SIZE, remaining))}
          remaining={texts.orders.remaining(remaining)}
          isLoading={pages.isFetchingNextPage}
          onClick={pages.showMore}
        />
      )}
    </section>
  );
}
