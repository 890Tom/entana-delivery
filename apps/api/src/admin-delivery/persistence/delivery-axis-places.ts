import { DEFAULT_PLACE_RADIUS_M } from "@entana/contracts";
import type { DeliveryAxisPlaceEntry } from "@entana/contracts";
import {
  DeliveryPlaceNameTakenError,
  DeliveryPlaceUnavailableError,
} from "../errors/admin-delivery-errors.js";
import {
  areAnyPlaceNamesTaken,
  findPlaceStates,
  insertPlace,
} from "./admin-delivery-axis-queries.js";
import type { AdminDeliveryAxisDatabase } from "./admin-delivery-axis-queries.js";

export interface ResolvedPlaces {
  /** Every place of the axis, in the order received. */
  readonly placeIds: readonly string[];
  /** The places created for this request. */
  readonly createdIds: readonly string[];
}

type NewPlaceEntry = Exclude<DeliveryAxisPlaceEntry, { placeId: string }>;

const isExisting = (entry: DeliveryAxisPlaceEntry): entry is { placeId: string } =>
  "placeId" in entry;

async function assertExistingPlacesUsable(
  database: AdminDeliveryAxisDatabase,
  ids: readonly string[],
  alreadyLinked: ReadonlySet<string>,
): Promise<void> {
  const states = await findPlaceStates(database, ids);
  // An inactive place stays in an axis that already holds it, and cannot be added to another.
  const usable = new Set(
    states.filter((place) => place.active || alreadyLinked.has(place.id)).map(({ id }) => id),
  );
  if (!ids.every((id) => usable.has(id))) {
    throw new DeliveryPlaceUnavailableError();
  }
}

async function assertNewNamesFree(
  database: AdminDeliveryAxisDatabase,
  entries: readonly NewPlaceEntry[],
): Promise<void> {
  const names = entries.map((entry) => entry.name);
  const isRepeated = new Set(names.map((name) => name.toLowerCase())).size !== names.length;
  if (isRepeated || (names.length > 0 && (await areAnyPlaceNamesTaken(database, names)))) {
    throw new DeliveryPlaceNameTakenError();
  }
}

/**
 * Checks the places of a request and creates the new ones, in the order received. Must run
 * under the lock of the axes: the names are checked here, then inserted.
 */
export async function resolveAxisPlaces(
  database: AdminDeliveryAxisDatabase,
  entries: readonly DeliveryAxisPlaceEntry[],
  alreadyLinked: ReadonlySet<string>,
): Promise<ResolvedPlaces> {
  const existingIds = entries.filter(isExisting).map((entry) => entry.placeId.toLowerCase());
  await assertExistingPlacesUsable(database, existingIds, alreadyLinked);
  await assertNewNamesFree(
    database,
    entries.filter((entry): entry is NewPlaceEntry => !isExisting(entry)),
  );
  const placeIds: string[] = [];
  const createdIds: string[] = [];
  for (const entry of entries) {
    if (isExisting(entry)) {
      placeIds.push(entry.placeId.toLowerCase());
      continue;
    }
    const id = await insertPlace(database, {
      name: entry.name,
      lat: entry.latitude,
      lng: entry.longitude,
      radiusM: entry.radiusM ?? DEFAULT_PLACE_RADIUS_M,
    });
    placeIds.push(id);
    createdIds.push(id);
  }
  return { placeIds, createdIds };
}
