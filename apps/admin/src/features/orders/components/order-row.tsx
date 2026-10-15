import type { AdminOrderListItem } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { Link } from "wouter";
import { orderPath } from "../../../routes";
import { formatAmount, formatPhone, formatTime } from "../../../order-display/format-order";
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

/** A cell of a main line and a muted one under it; no muted line when there is no detail. */
function TwoLineCell({
  main,
  detail,
  className,
}: {
  main: string;
  detail: string | null;
  className?: string;
}): ReactElement {
  return (
    <td className={className}>
      <span className={styles.line}>{main}</span>
      {detail !== null && <span className={[styles.line, styles.muted].join(" ")}>{detail}</span>}
    </td>
  );
}

/** The place and its axis, or « Hors axe » for an order outside every axis or older than zones. */
function ZoneCell({ zone }: { zone: AdminOrderListItem["deliveryZone"] }): ReactElement {
  return zone === null ? (
    <TwoLineCell main={texts.orders.outsideAxis} detail={null} />
  ) : (
    <TwoLineCell main={zone.placeName} detail={zone.axisName} />
  );
}

/** One order of the table: the checkbox, the order, the customer, the zone, the amount, the status. */
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
        <span className={[styles.line, styles.muted].join(" ")}>{formatTime(order.createdAt)}</span>
      </td>
      <TwoLineCell main={order.customerName} detail={phone} />
      <ZoneCell zone={order.deliveryZone} />
      <TwoLineCell
        className={styles.numeric}
        main={formatAmount(order.totalAr)}
        detail={texts.orders.articles(order.itemCount)}
      />
      <td>
        <StatusPill order={order} />
      </td>
      <td className={styles.actionCell}>
        <RowAction order={order} isPending={props.isPending} onAdvance={props.onAdvance} />
      </td>
    </tr>
  );
}
