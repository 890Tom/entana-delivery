import type { SeedContext } from "../lib/sql.ts";
import { insertRow, insertRowAndReturnId, pick } from "../lib/sql.ts";

interface SeededPlace {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
}

export interface SeededGeography {
  readonly places: readonly SeededPlace[];
  readonly axisIds: ReadonlyMap<string, string>;
}

interface DemoPlace {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

// Fictional coordinates around Antananarivo. The index of a place is its number in demo-orders.ts.
const DEMO_PLACES: readonly DemoPlace[] = [
  { name: "Analakely", lat: -18.9094, lng: 47.5251 },
  { name: "Behoririka", lat: -18.904, lng: 47.529 },
  { name: "Ankorondrano", lat: -18.883, lng: 47.525 },
  { name: "Ambohimanarina", lat: -18.865, lng: 47.524 },
  { name: "Ambohibao", lat: -18.833, lng: 47.478 },
  { name: "Mandrosoa", lat: -18.812, lng: 47.472 },
  { name: "Talatamaty", lat: -18.8, lng: 47.46 },
  { name: "Ankadifotsy", lat: -18.915, lng: 47.54 },
  { name: "Lieu fictif Est 1", lat: -18.92, lng: 47.56 },
  { name: "Lieu fictif Est 2", lat: -18.925, lng: 47.58 },
  { name: "Ambohimangakely", lat: -18.93, lng: 47.6 },
  { name: "Isotry", lat: -18.923, lng: 47.516 },
  { name: "Ampefiloha", lat: -18.938, lng: 47.52 },
  { name: "Lieu fictif Sud 1", lat: -18.955, lng: 47.515 },
  { name: "Lieu fictif Sud 2", lat: -18.97, lng: 47.505 },
  { name: "Lieu fictif Sud 3", lat: -18.99, lng: 47.49 },
  { name: "Ambohijanaka", lat: -19.01, lng: 47.47 },
  { name: "67 Ha", lat: -18.92, lng: 47.495 },
  { name: "Lieu fictif Ouest 1", lat: -18.89, lng: 47.5 },
] as const;

// Indexes into DEMO_PLACES, in the order of the axis. Three places belong to two axes
// (Analakely, Ambohimanarina, Isotry).
const DEMO_AXES = [
  { name: "Axe Nord", color: "#2f6b5a", places: [0, 1, 2, 3, 4, 5, 6] },
  { name: "Axe Est", color: "#9a4a2a", places: [0, 7, 8, 9, 10] },
  { name: "Axe Sud", color: "#7a2e5a", places: [11, 12, 13, 14, 15, 16] },
  { name: "Axe Ouest", color: "#7a5a1e", places: [11, 17, 18, 3] },
] as const;

// Default radius of a place (docs/data-model.md).
const DEFAULT_RADIUS_M = 500;

export async function seedPlacesAndAxes({ db }: SeedContext): Promise<SeededGeography> {
  const places: SeededPlace[] = [];
  for (const place of DEMO_PLACES) {
    const id = await insertRowAndReturnId(db, "place", {
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      radius_m: DEFAULT_RADIUS_M,
      active: true,
    });
    places.push({ id, lat: place.lat, lng: place.lng });
  }

  const axisIds = new Map<string, string>();
  for (const [axisIndex, axis] of DEMO_AXES.entries()) {
    const axisId = await insertRowAndReturnId(db, "delivery_axis", {
      name: axis.name,
      rank: axisIndex + 1,
      color: axis.color,
      active: true,
    });
    axisIds.set(axis.name, axisId);
    for (const [position, placeNumber] of axis.places.entries()) {
      await insertRow(db, "axis_place", {
        axis_id: axisId,
        place_id: pick(places, placeNumber).id,
        position: position + 1,
      });
    }
  }
  return { places, axisIds };
}
