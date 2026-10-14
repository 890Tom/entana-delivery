import { MAX_PLACES_PER_AXIS } from "@entana/contracts";
import type {
  AdminDeliveryAxis,
  AdminDeliveryPlace,
  SaveDeliveryAxisRequest,
} from "@entana/contracts";

/** A place of the axis being edited: what the list shows and the map draws. */
export type AxisFormPlace = AdminDeliveryPlace;

export interface AxisFormValues {
  readonly name: string;
  readonly color: string;
  readonly active: boolean;
  /** In the order of the route. */
  readonly places: readonly AxisFormPlace[];
}

/** What keeps the form from being sent. */
export interface AxisFormErrors {
  readonly name?: "empty";
  readonly places?: "empty";
}

/** The most results the place search shows at once. */
export const PLACE_SEARCH_LIMIT = 8;

export function formValuesOfAxis(axis: AdminDeliveryAxis): AxisFormValues {
  return {
    name: axis.name,
    color: axis.color,
    active: axis.active,
    places: axis.places.map(({ id, name, latitude, longitude, radiusM }) => ({
      id,
      name,
      latitude,
      longitude,
      radiusM,
    })),
  };
}

/** A new axis: active, with no place yet. */
export function newAxisForm(color: string): AxisFormValues {
  return { name: "", color, active: true, places: [] };
}

export function validateAxisForm(values: AxisFormValues): AxisFormErrors {
  return {
    ...(values.name.trim() === "" ? { name: "empty" } : {}),
    ...(values.places.length === 0 ? { places: "empty" } : {}),
  };
}

export function isAxisFormValid(values: AxisFormValues): boolean {
  const errors = validateAxisForm(values);
  return errors.name === undefined && errors.places === undefined;
}

const idsOf = (values: AxisFormValues): string => values.places.map((place) => place.id).join(",");

/** True when saving would change something: the spaces around the name do not count. */
export function isAxisFormChanged(initial: AxisFormValues, current: AxisFormValues): boolean {
  return (
    initial.name.trim() !== current.name.trim() ||
    initial.color !== current.color ||
    initial.active !== current.active ||
    idsOf(initial) !== idsOf(current)
  );
}

/** The body of the creation and of the change: every place is an existing one, by id. */
export function toSaveAxisRequest(values: AxisFormValues): SaveDeliveryAxisRequest {
  return {
    name: values.name.trim(),
    color: values.color,
    active: values.active,
    places: values.places.map((place) => ({ placeId: place.id })),
  };
}

export function canAddPlace(values: AxisFormValues): boolean {
  return values.places.length < MAX_PLACES_PER_AXIS;
}

/** Lower case, without accents: "Ambohibao" is found by "AMBOHIBAO", "Isotry" by "ïsotry". */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** The active places whose name holds the search, not already in the axis, a few at most. */
export function searchPlaces(
  places: readonly AdminDeliveryPlace[],
  search: string,
  values: AxisFormValues,
): readonly AdminDeliveryPlace[] {
  const term = normalise(search.trim());
  if (term === "") {
    return [];
  }
  const inAxis = new Set(values.places.map((place) => place.id));
  return places
    .filter((place) => !inAxis.has(place.id) && normalise(place.name).includes(term))
    .slice(0, PLACE_SEARCH_LIMIT);
}

/** The names of the other axes that hold a place, in priority order. */
export function otherAxesOf(
  axes: readonly AdminDeliveryAxis[],
  placeId: string,
  axisId: string | null,
): readonly string[] {
  return axes
    .filter((axis) => axis.id !== axisId && axis.places.some((place) => place.id === placeId))
    .map((axis) => axis.name);
}
