import type { ReactElement } from "react";

import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import type { DateOption } from "../rules/date-options";
import { formatDay } from "../rules/format-order";
import { ORDER_TABS } from "../rules/order-tabs";
import type { OrderTab } from "../rules/order-tabs";

import { OrderIcon } from "./order-icons";
import styles from "./order-filters.module.css";

interface OrderFiltersProps {
  readonly tab: OrderTab;
  readonly toProcessCount: number | null;
  readonly date: string;
  readonly dateOptions: readonly DateOption[];
  readonly searchText: string;
  readonly onTab: (tab: OrderTab) => void;
  readonly onDate: (date: string) => void;
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

function SearchField(props: Pick<OrderFiltersProps, "searchText" | "onSearch">): ReactElement {
  return (
    <label className={styles.search}>
      <span className={visuallyHidden.visuallyHidden}>{texts.orders.searchLabel}</span>
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
    </label>
  );
}

/** The status chips, the day and the search: the state lives in memory, never in the address. */
export function OrderFilters(props: OrderFiltersProps): ReactElement {
  return (
    <div className={styles.filters}>
      <StatusChips tab={props.tab} toProcessCount={props.toProcessCount} onTab={props.onTab} />
      <DateSelect date={props.date} dateOptions={props.dateOptions} onDate={props.onDate} />
      <SearchField searchText={props.searchText} onSearch={props.onSearch} />
    </div>
  );
}
