import type { AdminOrderListItem } from "@entana/contracts";
import type { ReactElement } from "react";

import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import type { OrderTablePage } from "../hooks/use-order-table-page";
import { useOrdersScreen } from "../hooks/use-orders-screen";
import type { OrdersScreenModel } from "../hooks/use-orders-screen";
import { canSelectAll, hasToProcessSection } from "../rules/order-tabs";

import { NewOrdersBanner } from "./new-orders-banner";
import { OrderFilters } from "./order-filters";
import styles from "./orders-screen.module.css";
import { OrdersTable } from "./orders-table";
import { SelectionBar } from "./selection-bar";
import { ToProcessSection } from "./to-process-section";

function ActionNotice({ model }: { model: OrdersScreenModel }): ReactElement | null {
  const notice = model.actions.notice;
  if (notice === null) {
    return null;
  }
  switch (notice.kind) {
    case "conflict":
      return <Notice tone="info">{texts.orders.conflict}</Notice>;
    case "failed":
      return <Notice tone="error">{texts.orders.actionFailed}</Notice>;
    case "partial":
      return (
        <Notice tone="info">{texts.orders.selection.partial(notice.done, notice.failed)}</Notice>
      );
  }
}

function LoadProblem({ model }: { model: OrdersScreenModel }): ReactElement | null {
  const failing = [model.toProcess, model.table].find((pages) => pages?.errorKind != null);
  if (failing === undefined || failing === null) {
    return null;
  }
  if (failing.errorKind === "invalid") {
    return <Notice tone="info">{texts.orders.searchInvalid}</Notice>;
  }
  return (
    <Notice tone="error" action={{ label: texts.common.retry, onClick: failing.retry }}>
      {texts.orders.loadFailed}
    </Notice>
  );
}

function findRow(model: OrdersScreenModel, id: string): AdminOrderListItem | undefined {
  return model.table?.items.find((item) => item.id === id);
}

function OtherOrders({
  model,
  table,
}: {
  model: OrdersScreenModel;
  table: OrderTablePage;
}): ReactElement {
  return (
    <OrdersTable
      pages={table}
      countryCode={model.countryCode}
      selection={model.selection}
      canSelectAll={canSelectAll(model.tab)}
      pendingIds={model.actions.pendingIds}
      hasFilter={model.searchText.trim().length >= 2}
      onToggleRow={(id) => {
        const row = findRow(model, id);
        if (row !== undefined) {
          model.toggleOne(row);
        }
      }}
      onToggleAll={model.toggleAll}
      onAdvance={(id) => {
        const row = findRow(model, id);
        if (row !== undefined) {
          model.actions.advance(row);
        }
      }}
    />
  );
}

function OrdersBody({ model }: { model: OrdersScreenModel }): ReactElement {
  const { table, selection } = model;
  return (
    <>
      {hasToProcessSection(model.tab) && (
        <ToProcessSection
          pages={model.toProcess}
          countryCode={model.countryCode}
          hasFilter={model.searchText.trim().length >= 2}
        />
      )}
      {selection !== null && (
        <SelectionBar
          selection={selection}
          isRunning={model.actions.isBulkRunning}
          onRun={model.runSelection}
          onCancel={model.clearSelection}
        />
      )}
      {table !== null && <OtherOrders model={model} table={table} />}
    </>
  );
}

/** The orders of the shop: what to handle first, then the others. */
export function OrdersScreen(): ReactElement {
  const model = useOrdersScreen();
  const summary = model.newOrders.summary;
  return (
    <div className={styles.screen}>
      <header>
        <h1 className={styles.title}>{texts.orders.title}</h1>
        <p className={styles.summary}>
          {summary === undefined
            ? texts.common.loading
            : texts.orders.summary(summary.toProcessCount, summary.todayCount)}
        </p>
      </header>
      <OrderFilters
        tab={model.tab}
        toProcessCount={summary?.toProcessCount ?? null}
        date={model.date}
        dateOptions={model.dateOptions}
        searchText={model.searchText}
        onTab={model.selectTab}
        onDate={model.selectDate}
        onSearch={model.search}
      />
      {model.newOrders.banner !== null && (
        <NewOrdersBanner banner={model.newOrders.banner} onShow={model.showNewOrders} />
      )}
      <ActionNotice model={model} />
      <LoadProblem model={model} />
      <OrdersBody model={model} />
    </div>
  );
}
