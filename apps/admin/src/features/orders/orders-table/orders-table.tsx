import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import type { OrderTablePage } from "./use-order-table-page";
import { isRowSelectable } from "../rules/selection";
import type { Selection } from "../rules/selection";

import { OrderRow } from "./order-row";
import styles from "./orders-table.module.css";
import { Pagination } from "./pagination";

interface OrdersTableProps {
  readonly pages: OrderTablePage;
  readonly countryCode: string | null;
  readonly selection: Selection | null;
  readonly canSelectAll: boolean;
  readonly pendingIds: ReadonlySet<string>;
  readonly hasFilter: boolean;
  readonly onToggleRow: (id: string) => void;
  readonly onToggleAll: () => void;
  readonly onAdvance: (id: string) => void;
}

function TableHead(
  props: Pick<OrdersTableProps, "canSelectAll" | "onToggleAll"> & {
    isAllChecked: boolean;
    isEmpty: boolean;
  },
): ReactElement {
  const c = texts.orders.columns;
  return (
    <thead>
      <tr>
        <th scope="col">
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={props.isAllChecked}
            disabled={!props.canSelectAll || props.isEmpty}
            aria-label={c.selectAll}
            onChange={props.onToggleAll}
          />
        </th>
        <th scope="col">{c.order}</th>
        <th scope="col">{c.customer}</th>
        <th scope="col">{c.zone}</th>
        <th scope="col" className={styles.numeric}>
          {c.total}
        </th>
        <th scope="col">{c.status}</th>
        <th scope="col" className={styles.actionCell}>
          {c.action}
        </th>
      </tr>
    </thead>
  );
}

function TableBody(props: OrdersTableProps): ReactElement {
  const { pages, selection } = props;
  return (
    <tbody>
      {pages.items.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          countryCode={props.countryCode}
          isChecked={selection?.ids.includes(order.id) ?? false}
          isSelectable={isRowSelectable(order, selection)}
          isPending={props.pendingIds.has(order.id)}
          onToggle={() => {
            props.onToggleRow(order.id);
          }}
          onAdvance={() => {
            props.onAdvance(order.id);
          }}
        />
      ))}
    </tbody>
  );
}

/** The other orders: a real table, one page at a time. */
export function OrdersTable(props: OrdersTableProps): ReactElement {
  const { pages, selection } = props;
  const isEmpty = pages.items.length === 0;
  return (
    <section className={styles.section} aria-labelledby="orders-others-title">
      <h2 id="orders-others-title" className={styles.title}>
        {texts.orders.otherTitle}
      </h2>
      {isEmpty && !pages.isPending ? (
        <p>{texts.orders.noMatch}</p>
      ) : (
        <div className={styles.frame}>
          <table className={styles.table}>
            <TableHead
              canSelectAll={props.canSelectAll}
              onToggleAll={props.onToggleAll}
              isEmpty={isEmpty}
              isAllChecked={selection !== null && selection.ids.length === pages.items.length}
            />
            <TableBody {...props} />
          </table>
        </div>
      )}
      {pages.pageCount > 1 && <Pagination page={pages} />}
    </section>
  );
}
