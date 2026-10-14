import { computeDeliveryFee, resolveDeliveryAxis } from "@entana/contracts";
import type {
  DeliveryFeeReason,
  DeliveryPlace,
  DeliverySettings,
  GeoPoint,
} from "@entana/contracts";

interface QuotablePlace extends DeliveryPlace {
  readonly name: string;
}

export interface QuotableAxis {
  readonly id: string;
  readonly rank: number;
  readonly active: boolean;
  readonly places: readonly { readonly place: QuotablePlace }[];
}

/** The fee for a point and a number of pieces, with what an order freezes and a quote shows. */
export interface DeliveryQuote {
  readonly feeAr: number;
  readonly reason: DeliveryFeeReason;
  /** Null outside an axis, including when the pieces make delivery free. */
  readonly axisId: string | null;
  readonly placeId: string | null;
  readonly placeName: string | null;
}

/**
 * Applies the rules of contracts to the loaded axes and settings; they are not rewritten here.
 * The match holds ids only: the place name comes from the rows that were loaded.
 */
export function quoteDelivery(
  point: GeoPoint,
  pieces: number,
  axes: readonly QuotableAxis[],
  settings: DeliverySettings,
): DeliveryQuote {
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
    return { feeAr, reason, axisId: null, placeId: null, placeName: null };
  }
  const place = axes
    .flatMap((axis) => axis.places.map((entry) => entry.place))
    .find((candidate) => candidate.id === match.place.id);
  return {
    feeAr,
    reason,
    axisId: match.axis.id,
    placeId: match.place.id,
    placeName: place?.name ?? null,
  };
}
