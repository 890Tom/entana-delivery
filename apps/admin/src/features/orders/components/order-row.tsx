import type { AdminOrderListItem } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { Link } from "wouter";
import { orderPath } from "../../../routes";
import { formatAmount, formatPhone, formatTime } from "../rules/format-order";
import { nextStatus } from "../rules/selection";

import { ActionButton, ActionLink } from "./action-button";
import styles from "./orders-table.module.css";
import { StatusPill } from "./status-pill";

interface OrderRowProps {
  readonly order: AdminOrderListItem;
  readonly countryCode: string | null;
  readonly isChecked: boolean;
  readonly isSelectable: boolean;
  readonly isPending: boolean;
  readonly onToggle: () => void;
  readonly onAdvance: () => void;
}

function RowAction({
  order,
  isPending,
  onAdvance,
}: Pick<OrderRowProps, "order" | "isPending" | "onAdvance">): ReactElement {
  const a = texts.orders.actions;
  const to = nextStatus(order.status);
  if (to === null) {
    return (
      <ActionLink
        label={a.open}
        accessibleName={a.openLabel(order.publicCode)}
        variant="quiet"
        href={orderPath(order.id)}
      />
    );
  }
  const isDelivery = to === "OUT_FOR_DELIVERY";
  return (
    <ActionButton
      label={isDelivery ? a.outForDelivery : a.delivered}
      accessibleName={
        isDelivery ? a.outForDeliveryLabel(order.publicCode) : a.deliveredLabel(order.publicCode)
      }
      variant="secondary"
      icon="arrow-right"
      isDisabled={isPending}
      isBusy={isPending}
      onClick={onAdvance}
    />
  );
}

/** One order of the table: the checkbox, the order, the customer, the amount, the status. */
export function OrderRow(props: OrderRowProps): ReactElement {
  const { order, countryCode, isChecked, isSelectable, onToggle } = props;
  const phone = countryCode === null ? order.phone : formatPhone(order.phone, countryCode);
  return (
    <tr className={styles.row}>
      <td>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isChecked}
          disabled={!isSelectable}
          aria-label={texts.orders.selectRow(order.publicCode, order.customerName)}
          onChange={onToggle}
        />
      </td>
      <td>
        <Link href={orderPath(order.id)} className={styles.code}>
          #{order.publicCode}
        </Link>
        <span className={styles.muted}>{formatTime(order.createdAt)}</span>
      </td>
      <td>
        <span>{order.customerName}</span>
        <span className={styles.muted}>{phone}</span>
      </td>
      <td className={styles.numeric}>
        <span>{formatAmount(order.totalAr)}</span>
        <span className={styles.muted}>{texts.orders.articles(order.itemCount)}</span>
      </td>
      <td>
        <StatusPill order={order} />
      </td>
      <td className={styles.actionCell}>
        <RowAction order={order} isPending={props.isPending} onAdvance={props.onAdvance} />
      </td>
    </tr>
  );
}
