import type {
  AdminDeliveryAxis,
  AdminDeliveryAxisListResponse,
  AdminDeliveryPlaceListResponse,
} from "@entana/contracts";

/** A place row as the queries select it, with the column names of the table. */
export interface StoredPlace {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly radiusM: number;
  readonly active: boolean;
}

/** An axis row with its places in the order of their positions. */
export interface StoredAxis {
  readonly id: string;
  readonly name: string;
  readonly rank: number;
  readonly color: string;
  readonly active: boolean;
  readonly places: readonly { readonly position: number; readonly place: StoredPlace }[];
}

function toAdminDeliveryAxis(axis: StoredAxis, byRank: readonly StoredAxis[]): AdminDeliveryAxis {
  return {
    id: axis.id,
    name: axis.name,
    rank: axis.rank,
    color: axis.color,
    active: axis.active,
    places: axis.places.map(({ place }) => ({
      id: place.id,
      name: place.name,
      latitude: place.lat,
      longitude: place.lng,
      radiusM: place.radiusM,
      active: place.active,
      alsoIn: byRank
        .filter(
          (other) =>
            other.id !== axis.id && other.places.some((entry) => entry.place.id === place.id),
        )
        .map((other) => ({ id: other.id, name: other.name })),
    })),
  };
}

/** Every axis by rank; `alsoIn` is computed here, from the whole list, once per place. */
export function toAdminDeliveryAxes(axes: readonly StoredAxis[]): AdminDeliveryAxisListResponse {
  const byRank = [...axes].sort((left, right) => left.rank - right.rank);
  return { axes: byRank.map((axis) => toAdminDeliveryAxis(axis, byRank)) };
}

export function toAdminDeliveryPlaces(
  places: readonly StoredPlace[],
): AdminDeliveryPlaceListResponse {
  return {
    places: places.map((place) => ({
      id: place.id,
      name: place.name,
      latitude: place.lat,
      longitude: place.lng,
      radiusM: place.radiusM,
    })),
  };
}
