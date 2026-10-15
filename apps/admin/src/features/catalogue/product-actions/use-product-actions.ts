import type { AdminProduct } from "@entana/contracts";
import { useState } from "react";

import type { AdminResult } from "../../../data-fetching/fetch-admin";
import { texts } from "../../../i18n/texts";
import { patchAvailability, postRestore, postRetire } from "../api/catalogue-calls";
import { replaceProduct } from "../rules/product-list";

import type { NoticeState } from "../notice/use-catalogue-notice";
import type { ProductsModel } from "../api/use-products";

const t = texts.catalogue.notices;

export interface ProductActions {
  readonly pendingIds: ReadonlySet<string>;
  readonly toggleAvailability: (product: AdminProduct) => Promise<void>;
  readonly retire: (product: AdminProduct) => Promise<void>;
  readonly restore: (product: AdminProduct) => Promise<void>;
}

interface Change {
  readonly product: AdminProduct;
  readonly send: () => Promise<AdminResult<AdminProduct>>;
  /** What the person is told when it worked; null for a change that shows by itself. */
  readonly success: string | null;
  /** Whether a 409 means that the product was retired in the meantime (and the list is stale). */
  readonly isStaleOnConflict: boolean;
}

type Failure = Exclude<AdminResult<never>, { kind: "ok" }>;

/**
 * What a refused change says. A refused session says nothing: the reload shows the sign-in.
 * A product retired in the meantime says so and reloads, so that the list is the truth.
 */
function reportFailure(
  failure: Failure,
  change: Change,
  model: ProductsModel,
  notices: NoticeState,
): void {
  if (failure.kind === "unauthorized") {
    model.reload();
  } else if (failure.kind === "conflict" && change.isStaleOnConflict) {
    notices.show({ tone: "info", text: t.retiredMeanwhile });
    model.reload();
  } else {
    notices.show({ tone: "error", text: t.changeFailed });
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
 * One change of one product: no optimistic update, the row takes the answer of the server.
 */
function useProductChange(
  model: ProductsModel,
  notices: NoticeState,
): { pendingIds: ReadonlySet<string>; run: (change: Change) => Promise<void> } {
  const { pendingIds, setPending } = usePendingIds();
  const run = async (change: Change): Promise<void> => {
    notices.clear();
    setPending(change.product.id, true);
    const result = await change.send();
    setPending(change.product.id, false);
    if (result.kind !== "ok") {
      reportFailure(result, change, model, notices);
      return;
    }
    model.update((products) => replaceProduct(products, result.data));
    if (change.success !== null) {
      notices.show({ tone: "info", text: change.success });
    }
  };
  return { pendingIds, run };
}

export function useProductActions(model: ProductsModel, notices: NoticeState): ProductActions {
  const { pendingIds, run } = useProductChange(model, notices);
  return {
    pendingIds,
    toggleAvailability: (product) =>
      run({
        product,
        send: () => patchAvailability(product.id, !product.available),
        success: null,
        isStaleOnConflict: true,
      }),
    retire: (product) =>
      run({
        product,
        send: () => postRetire(product.id),
        success: t.retired(product.name),
        isStaleOnConflict: true,
      }),
    restore: (product) =>
      run({
        product,
        send: () => postRestore(product.id),
        success: t.restored(product.name),
        // A restore that is refused leaves the product retired: nothing to reload.
        isStaleOnConflict: false,
      }),
  };
}
