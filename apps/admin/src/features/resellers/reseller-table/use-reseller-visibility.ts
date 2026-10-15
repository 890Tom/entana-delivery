import type { AdminReseller } from "@entana/contracts";
import { useState } from "react";

import { patchReseller } from "../api/reseller-calls";
import { describeFailure } from "../rules/describe-save-failure";

import type { AdminFailure } from "../../../data-fetching/fetch-admin";
import { useResellersCache } from "../api/use-resellers";
import type { ResellersCache } from "../api/use-resellers";

/** What the list tells after a refused change of visibility. */
export type VisibilityNotice =
  | { readonly kind: "notPublishable"; readonly reseller: AdminReseller }
  | { readonly kind: "failed" };

export interface ResellerVisibility {
  readonly pendingIds: ReadonlySet<string>;
  readonly notice: VisibilityNotice | null;
  readonly toggle: (reseller: AdminReseller) => void;
  readonly clearNotice: () => void;
}

/** What a refused change says; a refused session says nothing: the next read shows the sign-in. */
function reportFailure(
  failure: AdminFailure,
  reseller: AdminReseller,
  sinks: {
    readonly cache: ResellersCache;
    readonly setNotice: (notice: VisibilityNotice) => void;
  },
): void {
  const view = describeFailure(failure);
  if (view.isUnauthorized) {
    sinks.cache.invalidate();
  } else if (view.hasPublishError) {
    sinks.setNotice({ kind: "notPublishable", reseller });
  } else {
    sinks.setNotice({ kind: "failed" });
    if (view.notice === "gone") {
      sinks.cache.invalidate();
    }
  }
}

function usePendingIds(): {
  pendingIds: ReadonlySet<string>;
  setPending: (id: string, isPending: boolean) => void;
} {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const setPending = (id: string, isPending: boolean): void => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (isPending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };
  return { pendingIds, setPending };
}

/**
 * The visibility switch of a row. No optimistic update: the row takes the answer of the server.
 * A reseller without its agreement is not sent: the list says why and offers its sheet.
 */
export function useResellerVisibility(): ResellerVisibility {
  const cache = useResellersCache();
  const { pendingIds, setPending } = usePendingIds();
  const [notice, setNotice] = useState<VisibilityNotice | null>(null);

  const toggle = (reseller: AdminReseller): void => {
    if (pendingIds.has(reseller.id)) {
      return;
    }
    setNotice(null);
    if (!reseller.visible && !reseller.consentGiven) {
      setNotice({ kind: "notPublishable", reseller });
      return;
    }
    setPending(reseller.id, true);
    void patchReseller(reseller.id, { visible: !reseller.visible }).then((result) => {
      setPending(reseller.id, false);
      if (result.kind === "ok") {
        cache.replace(result.data);
        return;
      }
      reportFailure(result, reseller, { cache, setNotice });
    });
  };

  return {
    pendingIds,
    notice,
    toggle,
    clearNotice: () => {
      setNotice(null);
    },
  };
}
