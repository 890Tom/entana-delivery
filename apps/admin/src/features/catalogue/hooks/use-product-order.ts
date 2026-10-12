import { useEffect, useRef } from "react";

import { texts } from "../../../i18n/texts";
import { putProductOrder } from "../api/catalogue-calls";
import { withActiveOrder } from "../rules/product-list";

import type { NoticeState } from "./use-catalogue-notice";
import type { ProductsModel } from "./use-products";

const SAVE_DELAY_MS = 500;

interface Latest {
  readonly model: ProductsModel;
  readonly notices: NoticeState;
  /** A move made while a request is in flight: it is newer than the answer of that request. */
  readonly hasNewerMove: () => boolean;
}

/** Sends the order. A refusal reads the list again and says so (a refused session, nothing). */
async function sendOrder(ids: readonly string[], latest: Latest): Promise<void> {
  const result = await putProductOrder(ids);
  if (result.kind === "ok") {
    if (!latest.hasNewerMove()) {
      latest.model.update(() => result.data.products);
    }
    return;
  }
  latest.model.reload();
  if (result.kind !== "unauthorized") {
    latest.notices.show({ tone: "error", text: texts.catalogue.notices.orderFailed });
  }
}

/**
 * Applies a new order at once, then sends it after 500 ms without another move: a series of
 * moves is one request, the last one wins.
 */
export function useProductOrder(
  model: ProductsModel,
  notices: NoticeState,
): (ids: readonly string[]) => void {
  const pendingIds = useRef<readonly string[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The timer and the cleanup run later than the render: they read the latest closures.
  const latest = useRef<Latest>({ model, notices, hasNewerMove: () => false });
  useEffect(() => {
    latest.current = { model, notices, hasNewerMove: () => pendingIds.current !== null };
  });

  const flush = useRef((): void => {
    const ids = pendingIds.current;
    timer.current = null;
    pendingIds.current = null;
    if (ids !== null) {
      void sendOrder(ids, latest.current);
    }
  });

  useEffect(
    () => () => {
      // Leaving the screen within the delay must not lose the move.
      if (timer.current !== null) {
        clearTimeout(timer.current);
        flush.current();
      }
    },
    [],
  );

  return (ids) => {
    notices.clear();
    model.update((products) => withActiveOrder(products, ids));
    pendingIds.current = ids;
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(flush.current, SAVE_DELAY_MS);
  };
}
