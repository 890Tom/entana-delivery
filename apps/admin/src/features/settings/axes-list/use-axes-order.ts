import type { AdminDeliveryAxis } from "@entana/contracts";
import { useEffect, useRef, useState } from "react";

import { putAxesOrder } from "../api/axes-calls";

import type { AxesModel } from "../api/use-axes";

const SAVE_DELAY_MS = 500;

/** "changed": the server's list was not the one moved (it is read again). "failed": anything else. */
export type OrderNotice = "changed" | "failed";

export interface AxesOrder {
  readonly move: (ids: readonly string[]) => void;
  readonly notice: OrderNotice | null;
}

interface Latest {
  readonly model: AxesModel;
  readonly setNotice: (notice: OrderNotice | null) => void;
  /** A move made while a request is in flight: it is newer than the answer of that request. */
  readonly hasNewerMove: () => boolean;
}

function inOrder(axes: readonly AdminDeliveryAxis[], ids: readonly string[]): AdminDeliveryAxis[] {
  const byId = new Map(axes.map((axis) => [axis.id, axis]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/**
 * Sends the order. A failure puts the order of before the moves back; a list that changed on the
 * server, or a refused session, reads the list again.
 */
async function sendOrder(
  ids: readonly string[],
  before: readonly AdminDeliveryAxis[],
  latest: Latest,
): Promise<void> {
  const result = await putAxesOrder(ids);
  const { model, setNotice, hasNewerMove } = latest;
  if (result.kind === "ok") {
    if (!hasNewerMove()) {
      model.replace(result.data.axes);
    }
    return;
  }
  if (result.kind === "unauthorized") {
    model.reload();
    return;
  }
  if (result.problem === "axisOrderMismatch") {
    model.reload();
    setNotice("changed");
    return;
  }
  if (!hasNewerMove()) {
    model.replace(before);
  }
  setNotice("failed");
}

/**
 * Applies a new order at once, then sends it after 500 ms without another move: a series of
 * moves is one request, the last one wins.
 */
export function useAxesOrder(model: AxesModel): AxesOrder {
  const [notice, setNotice] = useState<OrderNotice | null>(null);
  const pending = useRef<{ ids: readonly string[]; before: readonly AdminDeliveryAxis[] } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The timer and the cleanup run later than the render: they read the latest closures.
  const latest = useRef<Latest>({ model, setNotice, hasNewerMove: () => false });
  useEffect(() => {
    latest.current = { model, setNotice, hasNewerMove: () => pending.current !== null };
  });

  const flush = useRef((): void => {
    const series = pending.current;
    timer.current = null;
    pending.current = null;
    if (series !== null) {
      void sendOrder(series.ids, series.before, latest.current);
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

  const move = (ids: readonly string[]): void => {
    const axes = model.axes ?? [];
    setNotice(null);
    // The order to put back is the one of before the whole series, not of its last move.
    pending.current = { ids, before: pending.current?.before ?? axes };
    model.replace(inOrder(axes, ids));
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(flush.current, SAVE_DELAY_MS);
  };
  return { move, notice };
}
