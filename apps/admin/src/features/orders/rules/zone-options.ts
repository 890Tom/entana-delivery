import type { AdminDeliveryAxis } from "@entana/contracts";

/** One choice of the zone filter; `value` is what the list sends as `zone` ("" sends nothing). */
export type ZoneOption =
  | { readonly kind: "all"; readonly value: "" }
  | {
      readonly kind: "axis";
      readonly value: string;
      readonly name: string;
      readonly isActive: boolean;
    }
  | { readonly kind: "none"; readonly value: "none" };

/**
 * Every zone, each axis in the order the API gives (its rank), then outside an axis. An inactive
 * axis stays: it may still have orders. Without the axes (loading, failure) the filter still works.
 */
export function buildZoneOptions(
  axes: readonly AdminDeliveryAxis[] | undefined,
): readonly ZoneOption[] {
  return [
    { kind: "all", value: "" },
    ...(axes ?? []).map((axis): ZoneOption => ({
      kind: "axis",
      value: axis.id,
      name: axis.name,
      isActive: axis.active,
    })),
    { kind: "none", value: "none" },
  ];
}
