import type { AdminOrderListItem } from "@entana/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { AdminResult } from "../../../data-fetching/fetch-admin";
import { postTransition } from "../api/orders-calls";
import { nextStatus } from "../rules/selection";
import type { Selection } from "../rules/selection";

import { ORDERS_KEY } from "../api/use-order-pages";

type ActionNotice =
  | { readonly kind: "conflict" }
  | { readonly kind: "failed" }
  | { readonly kind: "partial"; readonly done: number; readonly failed: number };

export interface OrderActions {
  readonly pendingIds: ReadonlySet<string>;
  readonly isBulkRunning: boolean;
  readonly notice: ActionNotice | null;
  readonly advance: (order: AdminOrderListItem) => void;
  readonly runBulk: (selection: Selection, rows: readonly AdminOrderListItem[]) => Promise<void>;
  readonly reload: () => void;
}

/** The one step of an order, or null when there is none. The answer is a value, never thrown. */
async function sendNextStep(
  order: Pick<AdminOrderListItem, "id" | "status">,
): Promise<AdminResult<unknown> | null> {
  const to = nextStatus(order.status);
  return to === null ? null : postTransition(order.id, to);
}

/** What a refused move says: nothing for a session that ended (the reload shows the sign-in). */
function toNotice(result: AdminResult<unknown> | null): ActionNotice | null {
  if (result === null || result.kind === "ok" || result.kind === "unauthorized") {
    return null;
  }
  return result.kind === "conflict" ? { kind: "conflict" } : { kind: "failed" };
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
 * One click, one transition, no confirmation. A refusal because the status moved in between
 * (409) says so and reloads: the list the person sees is then the truth.
 */
export function useOrderActions(): OrderActions {
  const queryClient = useQueryClient();
  const { pendingIds, setPending } = usePendingIds();
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const reload = (): void => {
    void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
  };
  const advance = (order: AdminOrderListItem): void => {
    setNotice(null);
    setPending(order.id, true);
    void sendNextStep(order).then((result) => {
      setPending(order.id, false);
      setNotice(toNotice(result));
      reload();
    });
  };
  const runBulk = async (
    selection: Selection,
    rows: readonly AdminOrderListItem[],
  ): Promise<void> => {
    const ordered = rows.filter((row) => selection.ids.includes(row.id));
    setNotice(null);
    setIsBulkRunning(true);
    let done = 0;
    for (const order of ordered) {
      // One after the other, in the order of the table: the shop sees them move in that order.
      done += (await sendNextStep(order))?.kind === "ok" ? 1 : 0;
    }
    setIsBulkRunning(false);
    if (done < ordered.length) {
      setNotice({ kind: "partial", done, failed: ordered.length - done });
    }
    reload();
  };
  return { pendingIds, isBulkRunning, notice, advance, runBulk, reload };
}
