import type { AdminOrderDetail } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import type { StatusChange } from "./use-status-change";
import { formatLongDay } from "../rules/format-detail";
import { STATUS_LOOKS } from "../rules/status-look";

import card from "../../../components/card/card.module.css";
import styles from "./decision-card.module.css";
import { DetailButton } from "../../../components/detail-button/detail-button";
import { FailAction } from "./fail-action";
import { NewOrderDecision } from "./new-order-decision";
import { RejectAction } from "./reject-action";

const d = texts.orderDetail.decision;

interface Props {
  readonly order: AdminOrderDetail;
  readonly today: string;
  readonly change: StatusChange;
}

function PlannedDay({ order }: { order: AdminOrderDetail }): ReactElement | null {
  if (order.deliveryDate === null) {
    return null;
  }
  return <p className={card.muted}>{d.plannedFor(formatLongDay(order.deliveryDate))}</p>;
}

/** What a closed order says: its status, its day if it had one, and the reason of a refusal. */
function FinalDecision({ order }: { order: AdminOrderDetail }): ReactElement {
  const day = order.deliveryDate === null ? null : formatLongDay(order.deliveryDate);
  const dayLine =
    day === null ? null : order.status === "DELIVERED" ? d.deliveredOn(day) : d.deliveryDay(day);
  return (
    <>
      <p className={styles.line}>{d.status(STATUS_LOOKS[order.status].label)}</p>
      {dayLine !== null && <p className={styles.line}>{dayLine}</p>}
      {order.status === "REJECTED" && order.rejectionReason !== null && (
        <p className={styles.line}>{d.reason(order.rejectionReason)}</p>
      )}
    </>
  );
}

function ConfirmedDecision({ order, change }: Omit<Props, "today">): ReactElement {
  return (
    <>
      <PlannedDay order={order} />
      <DetailButton
        label={d.startDelivery}
        variant="primary"
        isDisabled={change.isSending}
        isBusy={change.isSending}
        onClick={() => {
          void change.send({ to: "OUT_FOR_DELIVERY" });
        }}
      />
      <RejectAction order={order} change={change} />
    </>
  );
}

function OnTheRoadDecision({ order, change }: Omit<Props, "today">): ReactElement {
  return (
    <>
      <PlannedDay order={order} />
      <DetailButton
        label={d.markDelivered}
        variant="primary"
        isDisabled={change.isSending}
        isBusy={change.isSending}
        onClick={() => {
          void change.send({ to: "DELIVERED" });
        }}
      />
      <FailAction order={order} change={change} />
    </>
  );
}

function Actions({ order, today, change }: Props): ReactElement {
  switch (order.status) {
    case "NEW":
      return <NewOrderDecision order={order} today={today} change={change} />;
    case "CONFIRMED":
      return <ConfirmedDecision order={order} change={change} />;
    case "OUT_FOR_DELIVERY":
      return <OnTheRoadDecision order={order} change={change} />;
    case "DELIVERED":
    case "REJECTED":
    case "CANCELLED":
    case "FAILED":
      return <FinalDecision order={order} />;
  }
}

/** The card of the decision: the actions that the status allows, and what a change answered. */
export function DecisionCard({ order, today, change }: Props): ReactElement {
  return (
    <section aria-labelledby="decision-title" className={[card.card, styles.decision].join(" ")}>
      <h2 id="decision-title" className={card.title}>
        {d.title}
      </h2>
      <Actions order={order} today={today} change={change} />
    </section>
  );
}
