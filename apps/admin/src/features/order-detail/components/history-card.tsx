import type { AdminOrderDetail } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { describeInstant, formatEventTime } from "../rules/format-detail";
import { buildHistory } from "../rules/history";
import type { HistoryActor } from "../rules/history";

import card from "../../../components/card/card.module.css";
import styles from "./history-card.module.css";

const t = texts.orderDetail.history;

const STATUS_LABELS = {
  NEW: t.received,
  CONFIRMED: t.confirmed,
  OUT_FOR_DELIVERY: t.outForDelivery,
  DELIVERED: t.delivered,
  REJECTED: t.rejected,
  CANCELLED: t.cancelled,
  FAILED: t.failed,
} as const;

const ACTOR_LABELS: Readonly<Record<HistoryActor, string>> = {
  CUSTOMER: t.byCustomer,
  STAFF: t.byStaff,
  SYSTEM: t.bySystem,
};

/** One line per status change, oldest first: when, what, and who. */
export function HistoryCard({ order, now }: { order: AdminOrderDetail; now: Date }): ReactElement {
  return (
    <section aria-labelledby="history-title" className={card.card}>
      <h2 id="history-title" className={card.title}>
        {t.title}
      </h2>
      <ol className={styles.list}>
        {buildHistory(order.events).map((entry) => (
          <li key={`${entry.createdAt}-${entry.status}`} className={styles.entry}>
            <span className={styles.time}>
              {formatEventTime(describeInstant(entry.createdAt, now))}
            </span>
            <span>{STATUS_LABELS[entry.status]}</span>
            <span className={styles.actor}>{ACTOR_LABELS[entry.actor]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
