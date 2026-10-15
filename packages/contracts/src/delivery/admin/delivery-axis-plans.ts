export type DeliveryAxisField = "name" | "active" | "color" | "places";

export interface AxisContent {
  readonly name: string;
  readonly active: boolean;
  readonly color: string;
  /** The ids of the places, in the order of their positions. */
  readonly placeIds: readonly string[];
}

export type AxisUpdatePlan =
  | { readonly kind: "unchanged" }
  | { readonly kind: "changed"; readonly fields: readonly DeliveryAxisField[] };

/** What a replacement does to an axis: the fields that really change, in a fixed order. */
export function planAxisUpdate(before: AxisContent, after: AxisContent): AxisUpdatePlan {
  const fields: DeliveryAxisField[] = [];
  if (before.name !== after.name) {
    fields.push("name");
  }
  if (before.active !== after.active) {
    fields.push("active");
  }
  if (before.color !== after.color) {
    fields.push("color");
  }
  const isSameOrder =
    before.placeIds.length === after.placeIds.length &&
    before.placeIds.every((id, index) => id === after.placeIds[index]);
  if (!isSameOrder) {
    fields.push("places");
  }
  return fields.length === 0 ? { kind: "unchanged" } : { kind: "changed", fields };
}

export interface AxisRankMove {
  readonly id: string;
  readonly from: number;
  readonly to: number;
}

export type AxisReorderPlan =
  | { readonly kind: "mismatch" }
  | { readonly kind: "ordered"; readonly moves: readonly AxisRankMove[] };

/**
 * The new ranks (1..n in the order received) when `ids` holds every axis exactly once, in any
 * case of uuid; `moves` lists only the axes whose rank changes. Pure.
 */
export function planAxisReorder(
  current: readonly { readonly id: string; readonly rank: number }[],
  ids: readonly string[],
): AxisReorderPlan {
  const received = ids.map((id) => id.toLowerCase());
  const currentIds = new Set(current.map(({ id }) => id.toLowerCase()));
  const isPermutation =
    new Set(received).size === received.length &&
    received.length === currentIds.size &&
    received.every((id) => currentIds.has(id));
  if (!isPermutation) {
    return { kind: "mismatch" };
  }
  const rankById = new Map(current.map(({ id, rank }) => [id.toLowerCase(), rank]));
  const moves = received.flatMap((id, index) => {
    const from = rankById.get(id);
    const to = index + 1;
    return from === undefined || from === to ? [] : [{ id, from, to }];
  });
  return { kind: "ordered", moves };
}
