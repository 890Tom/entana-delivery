import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import type { OrderTablePage } from "./use-order-table-page";

import { ActionButton } from "../action-button/action-button";
import styles from "./pagination.module.css";

const t = texts.orders.pagination;

/** Previous, the place among the pages, next. A button that cannot act stays, disabled. */
export function Pagination({ page }: { page: OrderTablePage }): ReactElement {
  return (
    <nav className={styles.bar} aria-label={t.label}>
      <ActionButton
        label={t.previous}
        variant="secondary"
        icon="arrow-left"
        isDisabled={!page.hasPrevious || page.isPending}
        onClick={page.showPrevious}
      />
      <p className={styles.place} aria-live="polite">
        {t.page(page.pageNumber, page.pageCount)}
      </p>
      <ActionButton
        label={t.next}
        variant="secondary"
        icon="arrow-right"
        isDisabled={!page.hasNext || page.isPending}
        onClick={page.showNext}
      />
    </nav>
  );
}
