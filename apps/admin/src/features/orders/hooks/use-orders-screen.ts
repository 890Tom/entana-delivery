import type { AdminOrderListItem } from "@entana/contracts";
import { useEffect, useMemo, useState } from "react";

import { useInstance } from "../../instance/hooks/use-instance";
import type { OrderListRequest } from "../api/orders-calls";
import { buildDateOptions } from "../rules/date-options";
import type { DateOption } from "../rules/date-options";
import { todayInShop } from "../../../order-display/format-order";
import { DEFAULT_TAB, tableStatuses } from "../rules/order-tabs";
import type { OrderTab } from "../rules/order-tabs";
import { pruneSelection, selectAllRows, toggleRow } from "../rules/selection";
import type { Selection } from "../rules/selection";

import { useDebouncedValue } from "./use-debounced-value";
import { useNewOrders } from "./use-new-orders";
import type { NewOrders } from "./use-new-orders";
import { useOrderActions } from "./use-order-actions";
import type { OrderActions } from "./use-order-actions";
import { useOrderPages } from "./use-order-pages";
import type { OrderPages } from "./use-order-pages";
import { useOrderTablePage } from "./use-order-table-page";
import type { OrderTablePage } from "./use-order-table-page";

const SEARCH_DELAY_MS = 300;
const MIN_SEARCH_LENGTH = 2;
const CARDS_PAGE_SIZE = 3;
// A request that is never sent: a tab without a table keeps the hook in place, disabled.
const UNUSED_REQUEST: OrderListRequest = { statuses: ["NEW"] };

export interface OrdersScreenModel {
  readonly tab: OrderTab;
  readonly date: string;
  readonly dateOptions: readonly DateOption[];
  readonly searchText: string;
  readonly countryCode: string | null;
  readonly toProcess: OrderPages;
  /** Null in the tab À traiter, which has no table. */
  readonly table: OrderTablePage | null;
  readonly newOrders: NewOrders;
  readonly actions: OrderActions;
  readonly selection: Selection | null;
  readonly selectTab: (tab: OrderTab) => void;
  readonly selectDate: (date: string) => void;
  readonly search: (text: string) => void;
  readonly toggleOne: (row: AdminOrderListItem) => void;
  readonly toggleAll: () => void;
  readonly clearSelection: () => void;
  readonly runSelection: () => void;
  readonly showNewOrders: () => void;
}

interface Filters {
  readonly tab: OrderTab;
  readonly date: string;
  readonly searchText: string;
  readonly q: string | undefined;
}

function useFilters(today: string): Filters & {
  setTab: (tab: OrderTab) => void;
  setDate: (date: string) => void;
  setSearchText: (text: string) => void;
} {
  const [tab, setTab] = useState<OrderTab>(DEFAULT_TAB);
  const [date, setDate] = useState(today);
  const [searchText, setSearchText] = useState("");
  const trimmed = useDebouncedValue(searchText.trim(), SEARCH_DELAY_MS);
  const q = trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : undefined;
  return { tab, date, searchText, q, setTab, setDate, setSearchText };
}

/** The cards ask for NEW, three a page, never for a day; the table asks for the tab's statuses. */
function useLists(filters: Filters): {
  toProcess: OrderPages;
  table: OrderTablePage | null;
  rows: readonly AdminOrderListItem[];
} {
  const { tab, date, q } = filters;
  const toProcessRequest = useMemo<OrderListRequest>(
    () => ({ statuses: ["NEW"], limit: CARDS_PAGE_SIZE, ...(q === undefined ? {} : { q }) }),
    [q],
  );
  const tableRequest = useMemo<OrderListRequest>(() => {
    const statuses = tableStatuses(tab);
    return statuses === null
      ? UNUSED_REQUEST
      : { statuses, ...(date === "" ? {} : { date }), ...(q === undefined ? {} : { q }) };
  }, [tab, date, q]);
  const hasTable = tableStatuses(tab) !== null;
  const toProcess = useOrderPages(toProcessRequest, true);
  const table = useOrderTablePage(tableRequest, hasTable);
  const rows = useMemo(() => (hasTable ? table.items : []), [hasTable, table.items]);
  return { toProcess, table: hasTable ? table : null, rows };
}

interface SelectionState {
  readonly selection: Selection | null;
  readonly reset: () => void;
  readonly toggleOne: (row: AdminOrderListItem) => void;
  readonly toggleAll: () => void;
  readonly run: () => void;
}

/** The ticked rows. An id that left the list, or changed status, drops out after each reload. */
function useSelectionState(
  rows: readonly AdminOrderListItem[],
  actions: OrderActions,
): SelectionState {
  const [selection, setSelection] = useState<Selection | null>(null);
  useEffect(() => {
    setSelection((current) => pruneSelection(current, rows));
  }, [rows]);
  return {
    selection,
    reset: () => {
      setSelection(null);
    },
    toggleOne: (row) => {
      setSelection((current) => toggleRow(current, row));
    },
    toggleAll: () => {
      const isAllSelected = selection !== null && selection.ids.length === rows.length;
      setSelection(isAllSelected ? null : selectAllRows(rows));
    },
    run: () => {
      if (selection !== null) {
        // The bar stays, disabled, while the orders move one after the other.
        void actions.runBulk(selection, rows).then(() => {
          setSelection(null);
        });
      }
    },
  };
}

/** The state of the screen lives in memory only: nothing in the address, nothing in a storage. */
export function useOrdersScreen(): OrdersScreenModel {
  const [today] = useState(() => todayInShop(new Date()));
  const filters = useFilters(today);
  const { toProcess, table, rows } = useLists(filters);
  const actions = useOrderActions();
  const selecting = useSelectionState(rows, actions);
  const newOrders = useNewOrders(
    toProcess.items.map((item) => item.id),
    toProcess.isSuccess,
  );
  // Any change of the view starts from an empty selection.
  const resetThen =
    <T>(change: (value: T) => void) =>
    (value: T): void => {
      selecting.reset();
      change(value);
    };
  return {
    tab: filters.tab,
    date: filters.date,
    dateOptions: useMemo(() => buildDateOptions(today), [today]),
    searchText: filters.searchText,
    countryCode: useInstance().data?.phoneCountryCode ?? null,
    toProcess,
    table,
    newOrders,
    actions,
    selection: selecting.selection,
    selectTab: resetThen(filters.setTab),
    selectDate: resetThen(filters.setDate),
    search: resetThen(filters.setSearchText),
    toggleOne: selecting.toggleOne,
    toggleAll: selecting.toggleAll,
    clearSelection: selecting.reset,
    runSelection: selecting.run,
    showNewOrders: () => {
      newOrders.acknowledge();
      actions.reload();
    },
  };
}
