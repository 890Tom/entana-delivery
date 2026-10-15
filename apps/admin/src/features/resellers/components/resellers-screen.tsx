import type { ReactElement } from "react";
import { useLocation } from "wouter";

import { FilterTabs } from "../../../components/filter-tabs/filter-tabs";
import type { FilterTab } from "../../../components/filter-tabs/filter-tabs";
import { Notice } from "../../../components/notice/notice";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import { RESELLERS_NEW_PATH, resellerPath } from "../../../routes";
import { CatalogueIcon } from "../../../components/catalogue-icons/catalogue-icons";
import { FormLink } from "../../../components/form-buttons/form-buttons";
import { useResellerVisibility } from "../hooks/use-reseller-visibility";
import type { VisibilityNotice } from "../hooks/use-reseller-visibility";
import { useResellersScreen } from "../hooks/use-resellers-screen";
import type { ResellersScreenModel } from "../hooks/use-resellers-screen";
import { RESELLER_TABS } from "../rules/reseller-list";
import type { ResellerCounts } from "../rules/reseller-list";

import { ResellerTable } from "./reseller-table";
import type { VisibilityControl } from "./reseller-table";
import styles from "./resellers-screen.module.css";

const t = texts.resellers;

/** "6 revendeurs · 2 à vérifier": the second part only when there is one. */
function summaryOf(counts: ResellerCounts): string {
  return [t.count(counts.total), ...(counts.stale > 0 ? [t.staleCount(counts.stale)] : [])].join(
    " · ",
  );
}

function tabsOf(counts: ResellerCounts): readonly FilterTab<(typeof RESELLER_TABS)[number]>[] {
  const countOf = {
    all: counts.total,
    active: counts.active,
    inactive: counts.inactive,
    stale: counts.stale,
  } as const;
  return RESELLER_TABS.map((key) => ({
    key,
    label: t.tabs[key],
    // The count of "Tous" is already in the summary.
    ...(key === "all"
      ? {}
      : { badge: { count: countOf[key], tone: key === "stale" ? "highlight" : "neutral" } }),
  }));
}

function StaleBanner({ model }: { model: ResellersScreenModel }): ReactElement | null {
  const { stale } = model.counts;
  if (stale === 0 || model.tab === "stale") {
    return null;
  }
  return (
    <div className={styles.banner}>
      <p>{stale === 1 ? t.banner.one : t.banner.many(stale)}</p>
      <button
        type="button"
        className={styles.bannerAction}
        onClick={() => {
          model.selectTab("stale");
          model.setSearch("");
        }}
      >
        {t.banner.show}
      </button>
    </div>
  );
}

function SearchField({ model }: { model: ResellersScreenModel }): ReactElement {
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

function EmptyList({ model }: { model: ResellersScreenModel }): ReactElement {
  if (model.counts.total === 0) {
    return <p className={styles.empty}>{t.empty.none}</p>;
  }
  const term = model.search.trim();
  return (
    <div className={styles.empty}>
      <p>{term === "" ? t.empty.emptyList : t.empty.noMatch(term)}</p>
      <button type="button" className={styles.clear} onClick={model.showAll}>
        {t.empty.showAll}
      </button>
    </div>
  );
}

/** A refused change of visibility: why, and for the missing agreement, the way to the sheet. */
function VisibilityNoticeView({
  notice,
}: {
  notice: VisibilityNotice | null;
}): ReactElement | null {
  const [, navigate] = useLocation();
  if (notice === null) {
    return null;
  }
  if (notice.kind === "failed") {
    return <Notice tone="error">{t.notices.changeFailed}</Notice>;
  }
  const { reseller } = notice;
  return (
    <Notice
      tone="error"
      action={{
        label: t.notices.openSheet,
        onClick: () => {
          navigate(resellerPath(reseller.id));
        },
      }}
    >
      {t.notices.notPublishable(reseller.name)}
    </Notice>
  );
}

function Body({
  model,
  visibility,
}: {
  model: ResellersScreenModel;
  visibility: VisibilityControl;
}): ReactElement {
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
      <ResellerTable resellers={model.visible} now={model.now} visibility={visibility} />
      <p className={styles.footnote}>{t.footnote}</p>
    </>
  );
}

/** The resellers of the shop, in the order of the API, with their verification and visibility. */
export function ResellersScreen(): ReactElement {
  const model = useResellersScreen();
  const visibility = useResellerVisibility();
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.title}</h1>
          {model.status === "ready" && <p className={styles.summary}>{summaryOf(model.counts)}</p>}
        </div>
        <FormLink
          href={RESELLERS_NEW_PATH}
          label={t.add}
          variant="primary"
          icon={<CatalogueIcon name="plus" size={20} />}
        />
      </header>
      <StaleBanner model={model} />
      <div className={styles.filters}>
        <FilterTabs
          label={t.tabsLabel}
          tabs={tabsOf(model.counts)}
          selected={model.tab}
          onSelect={model.selectTab}
        />
        <SearchField model={model} />
      </div>
      <VisibilityNoticeView notice={visibility.notice} />
      <Body
        model={model}
        visibility={{ pendingIds: visibility.pendingIds, onToggle: visibility.toggle }}
      />
    </div>
  );
}
