import type { AdminDeliveryPlace, GeoPoint } from "@entana/contracts";

import { circleRing } from "./axes-drawing";
import type { AxisFormValues } from "./axis-form";
import type { ShapeCollection } from "./axes-drawing";

interface DrawnPlace extends GeoPoint {
  readonly radiusM: number;
}

/** A place of the axis being edited: its number on the map is its rank in the list. */
interface NamedPlace extends DrawnPlace {
  readonly name: string;
}

/** What the map of the axis editor shows. */
export interface AxisDrawing {
  readonly color: string;
  /** In the order of the route. */
  readonly places: readonly NamedPlace[];
  /** The other active places of the shop, drawn grey: what can still be added. */
  readonly others: readonly DrawnPlace[];
}

export function toAxisDrawing(
  values: AxisFormValues,
  activePlaces: readonly AdminDeliveryPlace[],
): AxisDrawing {
  const inAxis = new Set(values.places.map((place) => place.id));
  return {
    color: values.color,
    places: values.places.map((place) => ({
      name: place.name,
      lat: place.latitude,
      lng: place.longitude,
      radiusM: place.radiusM,
    })),
    others: activePlaces
      .filter((place) => !inAxis.has(place.id))
      .map((place) => ({ lat: place.latitude, lng: place.longitude, radiusM: place.radiusM })),
  };
}

/** The outlines of the other places: circles only, no line between them. */
export function toOtherZones(places: readonly DrawnPlace[]): ShapeCollection {
  return {
    type: "FeatureCollection",
    features: places.map((place) => ({
      type: "Feature",
      properties: { color: "" },
      geometry: { type: "Polygon", coordinates: [circleRing(place, place.radiusM)] },
    })),
  };
}
