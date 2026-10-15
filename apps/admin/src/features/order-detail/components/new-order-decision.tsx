import type { AdminOrderDetail } from "@entana/contracts";
import { useState } from "react";
import type { ReactElement } from "react";

import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { readPriceInput, showPriceInput } from "../../catalogue/rules/product-form";
import type { StatusChange } from "../hooks/use-status-change";
import { resolveChosenDay } from "../rules/delivery-days";
import type { ChosenDay, DaySelection } from "../rules/delivery-days";
import { confirmRequestOf, readFeeChoice } from "../rules/delivery-fee-input";
import type { FeeChoice } from "../rules/delivery-fee-input";
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

interface FeeEntry {
  readonly digits: string;
  readonly choice: FeeChoice;
  /** True once the amount changed after the last attempt: a refusal no longer speaks of it. */
  readonly isEditedSinceSend: boolean;
  readonly edit: (digits: string) => void;
  readonly markSent: () => void;
}

/** The field starts with the fee the order has. */
function useFeeEntry(currentFeeAr: number): FeeEntry {
  const [digits, setDigits] = useState(String(currentFeeAr));
  const [isEditedSinceSend, setIsEditedSinceSend] = useState(false);
  return {
    digits,
    choice: readFeeChoice(currentFeeAr, digits),
    isEditedSinceSend,
    edit: (next) => {
      setDigits(next);
      setIsEditedSinceSend(true);
    },
    markSent: () => {
      setIsEditedSinceSend(false);
    },
  };
}

/**
 * The error under the fee: a value the schema refuses, or a total the server refused for the
 * amount sent, until the amount changes.
 */
function feeErrorOf(entry: FeeEntry, notice: StatusChange["notice"]): string | undefined {
  if (entry.choice.kind === "invalid") {
    return d.feeInvalid;
  }
  return notice === "totalTooLarge" && !entry.isEditedSinceSend ? d.totalTooLarge : undefined;
}

/** The fee of this order only, filled with the one it has; typed as digits, like a price. */
function FeeField({
  digits,
  error,
  onChange,
}: {
  digits: string;
  error: string | undefined;
  onChange: (digits: string) => void;
}): ReactElement {
  return (
    <TextField
      label={d.feeLabel}
      hint={d.feeHint}
      inputMode="numeric"
      value={showPriceInput(digits)}
      error={error}
      onChange={(text) => {
        onChange(readPriceInput(text));
      }}
    />
  );
}

/** Available once a day is picked and the fee is valid; the label names the day only. */
function ConfirmButton({
  day,
  fee,
  change,
  onSend,
}: {
  day: string | null;
  fee: FeeChoice;
  change: StatusChange;
  onSend: () => void;
}): ReactElement {
  return (
    <DetailButton
      label={day === null ? d.confirmIdle : d.confirmFor(formatLongDay(day))}
      variant="primary"
      icon="check"
      isDisabled={day === null || fee.kind === "invalid" || change.isSending}
      isBusy={change.isSending}
      onClick={() => {
        if (day !== null && fee.kind !== "invalid") {
          onSend();
          void change.send(confirmRequestOf(day, fee));
        }
      }}
    />
  );
}

/**
 * The decision of an order to handle: a day is picked and the fee checked, then "Confirmer pour …"
 * becomes available; "Refuser…" opens the modal of the refusal.
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
  const fee = useFeeEntry(order.deliveryFeeAr);
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
      <FeeField digits={fee.digits} error={feeErrorOf(fee, change.notice)} onChange={fee.edit} />
      <ConfirmButton day={day} fee={fee.choice} change={change} onSend={fee.markSent} />
      <RejectAction order={order} change={change} />
      <p className={card.muted}>{d.informed}</p>
    </>
  );
}
