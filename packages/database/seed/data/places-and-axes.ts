import { DEMO_CENTRE } from "./config.ts";
import type { SeedContext } from "../lib/sql.ts";
import { insertRow, insertRowAndReturnId, pick } from "../lib/sql.ts";

export interface SeededPlace {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
}

export interface SeededGeography {
  readonly places: readonly SeededPlace[];
  readonly axisIds: ReadonlyMap<string, string>;
}

const PLACE_COUNT = 10;
const KILOMETRES_PER_DEGREE_OF_LATITUDE = 111.32;

// Places spiral around the centre: deterministic, so two seeds give the same map.
function positionAround(index: number): { lat: number; lng: number } {
  const angle = (index * 36 * Math.PI) / 180;
  const distanceKm = 0.6 + index * 0.35;
  const lat = DEMO_CENTRE.lat + (distanceKm * Math.sin(angle)) / KILOMETRES_PER_DEGREE_OF_LATITUDE;
  const lngScale = KILOMETRES_PER_DEGREE_OF_LATITUDE * Math.cos((DEMO_CENTRE.lat * Math.PI) / 180);
  const lng = DEMO_CENTRE.lng + (distanceKm * Math.cos(angle)) / lngScale;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

// Place numbers (0 to 9) along each axis. Place 3 belongs to two axes.
const DEMO_AXES = [
  { name: "Demo Axis North", places: [0, 1, 2, 3] },
  { name: "Demo Axis East", places: [3, 4, 5, 6] },
  { name: "Demo Axis South", places: [7, 8, 9] },
] as const;

export async function seedPlacesAndAxes({ db }: SeedContext): Promise<SeededGeography> {
  const places: SeededPlace[] = [];
  for (let index = 0; index < PLACE_COUNT; index += 1) {
    const { lat, lng } = positionAround(index);
    const id = await insertRowAndReturnId(db, "place", {
      name: `Demo Place ${String(index + 1).padStart(2, "0")}`,
      lat,
      lng,
      // Between 100 and 3000 (ck_place_radius_range).
      radius_m: 300 + index * 80,
      active: true,
    });
    places.push({ id, lat, lng });
  }

  const axisIds = new Map<string, string>();
  for (const [axisIndex, axis] of DEMO_AXES.entries()) {
    const axisId = await insertRowAndReturnId(db, "delivery_axis", {
      name: axis.name,
      position: axisIndex + 1,
      active: true,
    });
    axisIds.set(axis.name, axisId);
    for (const [rank, placeNumber] of axis.places.entries()) {
      await insertRow(db, "axis_place", {
        axis_id: axisId,
        place_id: pick(places, placeNumber).id,
        position: rank + 1,
      });
    }
  }
  return { places, axisIds };
}
