import type { AdminOrderDetail } from "@entana/contracts";
import type { ReactElement } from "react";
import { useParams } from "wouter";

import { Notice } from "../../components/notice/notice";
import { texts } from "../../i18n/texts";
import { useRefinedScreenTitle } from "../../layout/document-title/document-title";
import { useNow } from "../../clock/use-now";
import { useOrderDetail } from "./api/use-order-detail";
import { useStatusChange } from "./decision/use-status-change";
import type { StatusChange } from "./decision/use-status-change";
import { todayInShop } from "../../order-display/format-order";

import { AddressCard } from "./order-information/address-card";
import { CustomerCard } from "./order-information/customer-card";
import { DecisionCard } from "./decision/decision-card";
import { BackLink, DetailHeader } from "./header/detail-header";
import { HistoryCard } from "./order-information/history-card";
import { LinesCard } from "./order-information/lines-card";
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

/** The notices of the whole sheet; a refused fee is said by the confirmation, under its field. */
function ChangeNotice({ kind }: { kind: StatusChange["notice"] }): ReactElement | null {
  switch (kind) {
    case "conflict":
      return <Notice tone="info">{t.conflict}</Notice>;
    case "failed":
      return <Notice tone="error">{texts.orders.actionFailed}</Notice>;
    case "totalTooLarge":
    case null:
      return null;
  }
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
  useRefinedScreenTitle(t.title(order.publicCode));
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
