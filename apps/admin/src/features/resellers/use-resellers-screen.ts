import type { AdminReseller } from "@entana/contracts";
import { useState } from "react";

import { useNow } from "../../clock/use-now";
import { countResellers, visibleResellers } from "./rules/reseller-list";
import type { ResellerCounts, ResellerTab } from "./rules/reseller-list";

import { useResellers } from "./api/use-resellers";

export interface ResellersScreenModel {
  readonly status: "loading" | "failed" | "ready";
  readonly retry: () => void;
  readonly now: Date;
  readonly counts: ResellerCounts;
  readonly tab: ResellerTab;
  readonly search: string;
  readonly visible: readonly AdminReseller[];
  readonly selectTab: (tab: ResellerTab) => void;
  readonly setSearch: (text: string) => void;
  /** The filter and the search are cleared. */
  readonly showAll: () => void;
}

const NO_RESELLERS: readonly AdminReseller[] = [];

/** The state of the list: the resellers in the order of the API, the tab and the search. */
export function useResellersScreen(): ResellersScreenModel {
  const model = useResellers();
  const now = useNow();
  const [tab, setTab] = useState<ResellerTab>("all");
  const [search, setSearch] = useState("");
  const resellers = model.resellers ?? NO_RESELLERS;
  const status = model.resellers !== undefined ? "ready" : model.hasFailed ? "failed" : "loading";
  return {
    status,
    retry: model.retry,
    now,
    counts: countResellers(resellers, now),
    tab,
    search,
    visible: visibleResellers(resellers, tab, search, now),
    selectTab: setTab,
    setSearch,
    showAll: () => {
      setTab("all");
      setSearch("");
    },
  };
}
