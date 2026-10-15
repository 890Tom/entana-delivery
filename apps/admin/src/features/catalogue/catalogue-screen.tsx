import { useId } from "react";
import type { ReactElement } from "react";

import { FilterTabs } from "../../components/filter-tabs/filter-tabs";
import type { FilterTab } from "../../components/filter-tabs/filter-tabs";
import { Notice } from "../../components/notice/notice";
import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../i18n/texts";
import { useNow } from "../../clock/use-now";
import { OrderIcon } from "../../order-display/order-icons";
import { CATALOGUE_NEW_PATH } from "../../routes";
import { useCatalogueScreen } from "./use-catalogue-screen";
import type { CatalogueScreenModel } from "./use-catalogue-screen";
import { CATALOGUE_TABS } from "./rules/catalogue-view";
import type { CatalogueCounts } from "./rules/catalogue-view";

import styles from "./catalogue-screen.module.css";
import { CatalogueNoticeView } from "./notice/catalogue-notice-view";
import { FormLink } from "../../components/form-buttons/form-buttons";
import { CatalogueIcon } from "../../components/catalogue-icons/catalogue-icons";
import { ProductTable } from "./product-table/product-table";

const t = texts.catalogue;

/** "5 produits · 1 indisponible · 1 retiré": the last two only when there is one. */
function summaryOf(counts: CatalogueCounts): string {
  return [
    t.productCount(counts.active),
    ...(counts.unavailable > 0 ? [t.unavailableCount(counts.unavailable)] : []),
    ...(counts.retired > 0 ? [t.retiredCount(counts.retired)] : []),
  ].join(" · ");
}

function tabsOf(counts: CatalogueCounts): readonly FilterTab<(typeof CATALOGUE_TABS)[number]>[] {
  return CATALOGUE_TABS.map((key) => {
    const label = t.tabs[key];
    if (key === "unavailable") {
      return { key, label, badge: { count: counts.unavailable, tone: "highlight" } };
    }
    if (key === "retired") {
      return { key, label, badge: { count: counts.retired, tone: "neutral" } };
    }
    return { key, label };
  });
}

function SearchField({ model }: { model: CatalogueScreenModel }): ReactElement {
  return (
    <label className={styles.search}>
      <span className={visuallyHidden.visuallyHidden}>{t.searchLabel}</span>
      <OrderIcon name="search" size={20} />
      <input
        type="search"
        className={styles.input}
        value={model.search}
        placeholder={t.searchPlaceholder}
        onChange={(event) => {
          model.setSearch(event.target.value);
        }}
      />
    </label>
  );
}

function EmptyList({ model }: { model: CatalogueScreenModel }): ReactElement {
  const term = model.search.trim();
  if (term !== "") {
    return (
      <div className={styles.empty}>
        <p>{t.empty.noMatch(term)}</p>
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            model.setSearch("");
          }}
        >
          {t.empty.clearSearch}
        </button>
      </div>
    );
  }
  return (
    <p className={styles.empty}>{model.hasProducts ? t.empty.emptyList : t.empty.noProduct}</p>
  );
}

function Body({ model }: { model: CatalogueScreenModel }): ReactElement {
  const now = useNow();
  const helpId = useId();
  if (model.status === "loading") {
    return <p role="status">{t.loading}</p>;
  }
  if (model.status === "failed") {
    return (
      <Notice tone="error" action={{ label: texts.common.retry, onClick: model.retry }}>
        {t.loadFailed}
      </Notice>
    );
  }
  if (model.visible.length === 0) {
    return <EmptyList model={model} />;
  }
  return (
    <>
      <ProductTable
        products={model.visible}
        now={now}
        canReorder={model.canReorder}
        actionsOf={model.actionsOf}
        onMove={model.move}
        helpId={helpId}
      />
      <p id={helpId} className={styles.help}>
        {t.help}
      </p>
    </>
  );
}

/** The catalogue of the shop: availability, display order and retirement of each product. */
export function CatalogueScreen(): ReactElement {
  const model = useCatalogueScreen();
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.title}</h1>
          {model.status === "ready" && <p className={styles.summary}>{summaryOf(model.counts)}</p>}
        </div>
        <FormLink
          href={CATALOGUE_NEW_PATH}
          label={t.addProduct}
          variant="primary"
          icon={<CatalogueIcon name="plus" size={20} />}
        />
      </header>
      <div className={styles.filters}>
        <FilterTabs
          label={t.tabsLabel}
          tabs={tabsOf(model.counts)}
          selected={model.tab}
          onSelect={model.selectTab}
        />
        <SearchField model={model} />
      </div>
      <CatalogueNoticeView notice={model.notice} />
      <Body model={model} />
    </div>
  );
}
