import type {
  AdminDeliveryAxis,
  AdminDeliveryAxisPlace,
  AdminDeliveryPlace,
} from "@entana/contracts";

const idOf = (prefix: string, index: number): string =>
  `0199f5b0-7c1e-7a3b-${prefix}-${String(index).padStart(12, "0")}`;

/** A place of an axis. The index makes its id, its name and its position unique. */
export function buildAxisPlace(
  index: number,
  overrides: Partial<AdminDeliveryAxisPlace> = {},
): AdminDeliveryAxisPlace {
  return {
    id: idOf("8c2d", index),
    name: `Lieu ${String(index)}`,
    latitude: -18.9 + index / 100,
    longitude: 47.5 + index / 100,
    radiusM: 500,
    active: true,
    alsoIn: [],
    ...overrides,
  };
}

/** An axis of the admin list, active, with one place unless told otherwise. */
export function buildAxis(
  index: number,
  overrides: Partial<AdminDeliveryAxis> = {},
): AdminDeliveryAxis {
  return {
    id: idOf("9d4f", index),
    name: `Axe ${String(index)}`,
    rank: index,
    color: "#2f6b5a",
    active: true,
    places: [buildAxisPlace(index)],
    ...overrides,
  };
}

/** The same place as `buildAxisPlace`, as the list of active places gives it. */
export function buildPlace(
  index: number,
  overrides: Partial<AdminDeliveryPlace> = {},
): AdminDeliveryPlace {
  const { id, name, latitude, longitude, radiusM } = buildAxisPlace(index);
  return { id, name, latitude, longitude, radiusM, ...overrides };
}
