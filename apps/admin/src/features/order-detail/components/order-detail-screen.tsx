import type { AdminOrderDetail } from "@entana/contracts";
import type { ReactElement } from "react";
import { useParams } from "wouter";

import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import { useNow } from "../../../clock/use-now";
import { useOrderDetail } from "../hooks/use-order-detail";
import { useStatusChange } from "../hooks/use-status-change";
import { todayInShop } from "../../../order-display/format-order";

import { AddressCard } from "./address-card";
import { CustomerCard } from "./customer-card";
import { DecisionCard } from "./decision-card";
import { BackLink, DetailHeader } from "./detail-header";
import { HistoryCard } from "./history-card";
import { LinesCard } from "./lines-card";
import styles from "./order-detail-screen.module.css";

const t = texts.orderDetail;

function Message({ children }: { children: ReactElement | string }): ReactElement {
  return (
    <div className={styles.screen}>
      <BackLink />
      {children}
    </div>
  );
}

function ChangeNotice({ kind }: { kind: "conflict" | "failed" | null }): ReactElement | null {
  if (kind === null) {
    return null;
  }
  return kind === "conflict" ? (
    <Notice tone="info">{t.conflict}</Notice>
  ) : (
    <Notice tone="error">{texts.orders.actionFailed}</Notice>
  );
}

function ReadySheet({
  order,
  orderId,
}: {
  order: AdminOrderDetail;
  orderId: string;
}): ReactElement {
  const change = useStatusChange(orderId);
  const now = useNow();
  return (
    <div className={styles.screen}>
      <DetailHeader order={order} now={now} />
      <ChangeNotice kind={change.notice} />
      <div className={styles.grid}>
        <div className={styles.decision}>
          <DecisionCard order={order} today={todayInShop(now)} change={change} />
        </div>
        <div className={styles.lines}>
          <LinesCard order={order} />
        </div>
        <div className={styles.customer}>
          <CustomerCard order={order} />
        </div>
        <div className={styles.address}>
          <AddressCard order={order} />
        </div>
        <div className={styles.history}>
          <HistoryCard order={order} now={now} />
        </div>
      </div>
    </div>
  );
}

function Sheet({ orderId }: { orderId: string }): ReactElement {
  const state = useOrderDetail(orderId);
  switch (state.status) {
    case "loading":
      return <Message>{texts.common.loading}</Message>;
    case "not_found":
      return (
        <Message>
          <p className={styles.message}>{t.notFound}</p>
        </Message>
      );
    case "failed":
      return (
        <Message>
          <Notice tone="error" action={{ label: texts.common.retry, onClick: state.retry }}>
            {t.loadFailed}
          </Notice>
        </Message>
      );
    case "ready":
      return <ReadySheet order={state.order} orderId={orderId} />;
  }
}

/** The sheet of one order: read it, and make it move one step. */
export function OrderDetailScreen(): ReactElement {
  const { id } = useParams<{ id: string }>();
  return <Sheet key={id} orderId={id} />;
}
