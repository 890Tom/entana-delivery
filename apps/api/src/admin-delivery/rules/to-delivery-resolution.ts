import { computeDeliveryFee, resolveDeliveryAxis } from "@entana/contracts";
import type { DeliveryResolveResponse, DeliverySettings, GeoPoint } from "@entana/contracts";
import type { StoredAxis } from "./to-admin-delivery.js";

/**
 * Tests an address with the rules of contracts: the axis that serves the point, then the fee.
 * The rules are not rewritten here; this only gives the names the shop reads back.
 */
export function resolveAddress(
  point: GeoPoint,
  pieces: number,
  axes: readonly StoredAxis[],
  settings: DeliverySettings,
): DeliveryResolveResponse {
  const domainAxes = axes.map((axis) => ({
    id: axis.id,
    rank: axis.rank,
    active: axis.active,
    places: axis.places.map(({ place }) => place),
  }));
  const match = resolveDeliveryAxis(point, domainAxes);
  const { feeAr, reason } = computeDeliveryFee({
    match,
    totalPieces: pieces,
    outOfAxisFeeAr: settings.outOfAxisFeeAr,
    freeDeliveryMinPieces: settings.freeDeliveryMinPieces,
  });
  if (match === null) {
    return { match: null, feeAr, reason };
  }
  // The match holds ids; the names and the colour come from the rows that were loaded.
  const axis = findOrThrow(axes, match.axis.id);
  const place = findOrThrow(
    axis.places.map((entry) => entry.place),
    match.place.id,
  );
  return {
    match: {
      axis: { id: axis.id, name: axis.name, colorKey: axis.colorKey },
      place: { id: place.id, name: place.name },
    },
    feeAr,
    reason,
  };
}

// The match was computed from these very rows: a miss is a programming error, not a user case.
function findOrThrow<T extends { readonly id: string }>(rows: readonly T[], id: string): T {
  const row = rows.find((candidate) => candidate.id === id);
  if (row === undefined) {
    throw new Error("The delivery match does not point at a loaded row.");
  }
  return row;
}
