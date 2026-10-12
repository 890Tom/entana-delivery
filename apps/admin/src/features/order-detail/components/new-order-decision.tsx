import type { AdminOrderDetail } from "@entana/contracts";
import { useState } from "react";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import type { StatusChange } from "../hooks/use-status-change";
import { resolveChosenDay } from "../rules/delivery-days";
import type { ChosenDay, DaySelection } from "../rules/delivery-days";
import { formatLongDay } from "../rules/format-detail";

import card from "./card.module.css";
import { DayPicker } from "./day-picker";
import { DetailButton } from "./detail-button";
import { RejectAction } from "./reject-action";

const d = texts.orderDetail.decision;

interface DayChoice {
  readonly selection: DaySelection | null;
  readonly otherDay: string;
  readonly chosen: ChosenDay;
  readonly setSelection: (selection: DaySelection) => void;
  readonly setOtherDay: (day: string) => void;
}

/** Nothing is chosen by default: the shop must pick a day. */
function useDayChoice(today: string): DayChoice {
  const [selection, setSelection] = useState<DaySelection | null>(null);
  const [otherDay, setOtherDay] = useState("");
  return {
    selection,
    otherDay,
    chosen: resolveChosenDay(selection, otherDay, today),
    setSelection,
    setOtherDay,
  };
}

/**
 * The decision of an order to handle: a day is picked, then "Confirmer pour …" becomes
 * available; "Refuser…" opens the modal of the refusal.
 */
export function NewOrderDecision({
  order,
  today,
  change,
}: {
  order: AdminOrderDetail;
  today: string;
  change: StatusChange;
}): ReactElement {
  const choice = useDayChoice(today);
  const { day } = choice.chosen;
  return (
    <>
      <DayPicker
        today={today}
        selection={choice.selection}
        otherDay={choice.otherDay}
        chosen={choice.chosen}
        isDisabled={change.isSending}
        onSelect={choice.setSelection}
        onOtherDayChange={choice.setOtherDay}
      />
      <DetailButton
        label={day === null ? d.confirmIdle : d.confirmFor(formatLongDay(day))}
        variant="primary"
        icon="check"
        isDisabled={day === null || change.isSending}
        isBusy={change.isSending}
        onClick={() => {
          if (day !== null) {
            void change.send({ to: "CONFIRMED", deliveryDate: day });
          }
        }}
      />
      <RejectAction order={order} change={change} />
      <p className={card.muted}>{d.informed}</p>
    </>
  );
}
