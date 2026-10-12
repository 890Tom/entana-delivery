import type { OrderStatus } from "@entana/contracts";

/** Orders of one status only: the action of a selection is the next step of that status. */
export interface Selection {
  readonly status: OrderStatus;
  readonly ids: readonly string[];
}

interface RowLike {
  readonly id: string;
  readonly status: OrderStatus;
}

/** The status an order moves to in one click, or null when there is no step to take. */
export function nextStatus(status: OrderStatus): "OUT_FOR_DELIVERY" | "DELIVERED" | null {
  switch (status) {
    case "CONFIRMED":
      return "OUT_FOR_DELIVERY";
    case "OUT_FOR_DELIVERY":
      return "DELIVERED";
    case "NEW":
    case "DELIVERED":
    case "REJECTED":
    case "CANCELLED":
    case "FAILED":
      return null;
  }
}

/** A row can be ticked when it has a next step and no other status is already selected. */
export function isRowSelectable(row: RowLike, selection: Selection | null): boolean {
  return nextStatus(row.status) !== null && (selection === null || selection.status === row.status);
}

export function toggleRow(selection: Selection | null, row: RowLike): Selection | null {
  const ids = selection?.ids ?? [];
  const next = ids.includes(row.id) ? ids.filter((id) => id !== row.id) : [...ids, row.id];
  return next.length === 0 ? null : { status: row.status, ids: next };
}

/** Every loaded row of the tab, which holds one status. */
export function selectAllRows(rows: readonly RowLike[]): Selection | null {
  const first = rows[0];
  if (first === undefined || nextStatus(first.status) === null) {
    return null;
  }
  const same = rows.filter((row) => row.status === first.status);
  return { status: first.status, ids: same.map((row) => row.id) };
}

/** After a reload: an id that is gone, or whose status is no longer the selected one, leaves. */
export function pruneSelection(
  selection: Selection | null,
  rows: readonly RowLike[],
): Selection | null {
  if (selection === null) {
    return null;
  }
  const kept = selection.ids.filter((id) =>
    rows.some((row) => row.id === id && row.status === selection.status),
  );
  if (kept.length === selection.ids.length) {
    return selection;
  }
  return kept.length === 0 ? null : { status: selection.status, ids: kept };
}
