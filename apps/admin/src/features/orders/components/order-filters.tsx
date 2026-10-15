import { useId } from "react";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import type { DateOption } from "../rules/date-options";
import { formatDay } from "../../../order-display/format-order";
import { ORDER_TABS } from "../rules/order-tabs";
import type { OrderTab } from "../rules/order-tabs";
import type { ZoneOption } from "../rules/zone-options";

import { OrderIcon } from "../../../order-display/order-icons";
import styles from "./order-filters.module.css";

interface OrderFiltersProps {
  readonly tab: OrderTab;
  readonly toProcessCount: number | null;
  readonly date: string;
  readonly dateOptions: readonly DateOption[];
  readonly zone: string;
  readonly zoneOptions: readonly ZoneOption[];
  readonly searchText: string;
  readonly onTab: (tab: OrderTab) => void;
  readonly onDate: (date: string) => void;
  readonly onZone: (zone: string) => void;
  readonly onSearch: (text: string) => void;
}

function optionLabel(option: DateOption): string {
  const day = option.day === null ? "" : formatDay(option.day);
  switch (option.kind) {
    case "all":
      return texts.orders.allDates;
    case "today":
      return texts.orders.today(day);
    case "yesterday":
      return texts.orders.yesterday(day);
    case "earlier":
      return day;
  }
}

function zoneLabel(option: ZoneOption): string {
  switch (option.kind) {
    case "all":
      return texts.orders.allZones;
    case "axis":
      return option.isActive ? option.name : texts.orders.inactiveAxis(option.name);
    case "none":
      return texts.orders.outsideAxis;
  }
}

function StatusChips(
  props: Pick<OrderFiltersProps, "tab" | "toProcessCount" | "onTab">,
): ReactElement {
  return (
    <div role="group" aria-label={texts.orders.tabsLabel} className={styles.chips}>
      {ORDER_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          className={styles.chip}
          aria-pressed={props.tab === tab}
          onClick={() => {
            props.onTab(tab);
          }}
        >
          {texts.orders.tabs[tab]}
          {tab === "toProcess" && props.toProcessCount !== null && (
            <span className={styles.badge}>{props.toProcessCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function DateSelect(
  props: Pick<OrderFiltersProps, "date" | "dateOptions" | "onDate">,
): ReactElement {
  return (
    <label className={styles.field}>
      <span>{texts.orders.dateLabel}</span>
      <select
        className={styles.select}
        value={props.date}
        onChange={(event) => {
          props.onDate(event.target.value);
        }}
      >
        {props.dateOptions.map((option) => (
          <option key={option.kind + option.value} value={option.value}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ZoneSelect(
  props: Pick<OrderFiltersProps, "zone" | "zoneOptions" | "onZone">,
): ReactElement {
  return (
    <label className={styles.field}>
      <span>{texts.orders.zoneLabel}</span>
      <select
        className={styles.select}
        value={props.zone}
        onChange={(event) => {
          props.onZone(event.target.value);
        }}
      >
        {props.zoneOptions.map((option) => (
          <option key={option.kind + option.value} value={option.value}>
            {zoneLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SearchField(props: Pick<OrderFiltersProps, "searchText" | "onSearch">): ReactElement {
  return (
    <label className={styles.field}>
      <span>{texts.orders.searchLabel}</span>
      <span className={styles.search}>
        <OrderIcon name="search" size={20} />
        <input
          type="search"
          className={styles.input}
          value={props.searchText}
          placeholder={texts.orders.searchPlaceholder}
          onChange={(event) => {
            props.onSearch(event.target.value);
          }}
        />
      </span>
    </label>
  );
}

/** The zone, the day and the search on a row of their own, with a line that says what each reaches. */
function FilterFields(
  props: Omit<OrderFiltersProps, "tab" | "toProcessCount" | "onTab">,
): ReactElement {
  const hintId = useId();
  return (
    <div className={styles.fieldsBlock}>
      <div
        role="group"
        aria-label={texts.orders.filtersLabel}
        aria-describedby={hintId}
        className={styles.fields}
      >
        <ZoneSelect zone={props.zone} zoneOptions={props.zoneOptions} onZone={props.onZone} />
        <DateSelect date={props.date} dateOptions={props.dateOptions} onDate={props.onDate} />
        <SearchField searchText={props.searchText} onSearch={props.onSearch} />
      </div>
      <p id={hintId} className={styles.hint}>
        {texts.orders.filtersHint}
      </p>
    </div>
  );
}

/**
 * The status chips, then the zone, the day and the search: the state lives in memory, never in
 * the address.
 */
export function OrderFilters(props: OrderFiltersProps): ReactElement {
  const { tab, toProcessCount, onTab, ...fields } = props;
  return (
    <div className={styles.filters}>
      <StatusChips tab={tab} toProcessCount={toProcessCount} onTab={onTab} />
      <FilterFields {...fields} />
    </div>
  );
}
