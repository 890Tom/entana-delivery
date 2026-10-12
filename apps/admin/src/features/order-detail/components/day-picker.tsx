import { useId } from "react";
import type { ReactElement } from "react";

import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { formatDay } from "../../orders/rules/format-order";
import { buildQuickDays, deliveryWindow } from "../rules/delivery-days";
import type { ChosenDay, DaySelection, QuickDayKey } from "../rules/delivery-days";

import styles from "./day-picker.module.css";

const d = texts.orderDetail.decision;

const QUICK_LABELS: Readonly<Record<QuickDayKey, string>> = {
  today: d.today,
  tomorrow: d.tomorrow,
  dayAfter: d.dayAfter,
};

interface DayPickerProps {
  readonly today: string;
  readonly selection: DaySelection | null;
  readonly otherDay: string;
  readonly chosen: ChosenDay;
  readonly isDisabled: boolean;
  readonly onSelect: (selection: DaySelection) => void;
  readonly onOtherDayChange: (day: string) => void;
}

function Option({
  name,
  label,
  subLabel,
  isChecked,
  isDisabled,
  onSelect,
}: {
  name: string;
  label: string;
  subLabel: string;
  isChecked: boolean;
  isDisabled: boolean;
  onSelect: () => void;
}): ReactElement {
  return (
    <label className={[styles.option, isChecked ? styles.checked : ""].join(" ")}>
      <input
        type="radio"
        name={name}
        className={visuallyHidden.visuallyHidden}
        checked={isChecked}
        disabled={isDisabled}
        onChange={onSelect}
      />
      <span className={styles.label}>{label}</span>
      <span className={styles.subLabel}>{subLabel}</span>
    </label>
  );
}

function QuickOptions({
  today,
  selection,
  isDisabled,
  groupName,
  onSelect,
}: Pick<DayPickerProps, "today" | "selection" | "isDisabled" | "onSelect"> & {
  groupName: string;
}): ReactElement {
  return (
    <>
      {buildQuickDays(today).map((quick) => (
        <Option
          key={quick.key}
          name={groupName}
          label={QUICK_LABELS[quick.key]}
          subLabel={formatDay(quick.day)}
          isChecked={selection?.kind === "quick" && selection.key === quick.key}
          isDisabled={isDisabled}
          onSelect={() => {
            onSelect({ kind: "quick", key: quick.key });
          }}
        />
      ))}
    </>
  );
}

function DateInput({
  today,
  otherDay,
  chosen,
  isDisabled,
  onOtherDayChange,
}: Pick<
  DayPickerProps,
  "today" | "otherDay" | "chosen" | "isDisabled" | "onOtherDayChange"
>): ReactElement {
  const dateId = useId();
  const bounds = deliveryWindow(today);
  return (
    <div className={styles.date}>
      <label htmlFor={dateId} className={styles.dateLabel}>
        {d.pickDay}
      </label>
      <input
        id={dateId}
        type="date"
        className={styles.dateControl}
        min={bounds.min}
        max={bounds.max}
        value={otherDay}
        disabled={isDisabled}
        aria-invalid={chosen.isInvalid ? true : undefined}
        onChange={(event) => {
          onOtherDayChange(event.target.value);
        }}
      />
    </div>
  );
}

/**
 * "Jour de livraison": the three next days and a date of the calendar, as one radio group. No
 * option is selected by default: the shop must choose.
 */
export function DayPicker(props: DayPickerProps): ReactElement {
  const groupName = useId();
  const { selection, chosen, isDisabled, onSelect } = props;
  const isOtherSelected = selection?.kind === "other";
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{d.dayLegend}</legend>
      <div className={styles.options}>
        <QuickOptions {...props} groupName={groupName} />
        <Option
          name={groupName}
          label={d.otherDate}
          subLabel={chosen.day !== null && isOtherSelected ? formatDay(chosen.day) : d.calendar}
          isChecked={isOtherSelected}
          isDisabled={isDisabled}
          onSelect={() => {
            onSelect({ kind: "other" });
          }}
        />
      </div>
      {isOtherSelected && <DateInput {...props} />}
      {chosen.isInvalid && (
        <p role="alert" className={styles.error}>
          {d.invalidDay}
        </p>
      )}
    </fieldset>
  );
}
