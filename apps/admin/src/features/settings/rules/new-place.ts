import {
  DEFAULT_PLACE_RADIUS_M,
  DELIVERY_NAME_MAX_LENGTH,
  PLACE_RADIUS_MAX_M,
  PLACE_RADIUS_MIN_M,
} from "@entana/contracts";
import type { AdminDeliveryAxis, AdminDeliveryPlace } from "@entana/contracts";

import type { AxisFormValues } from "./axis-form";

/** What the window « Nouveau lieu » holds before the place joins the axis. */
export interface NewPlaceFields {
  readonly name: string;
  /** As typed in the number field: the slider writes it too. */
  readonly radiusText: string;
}

export type NewPlaceNameError = "empty" | "tooLong" | "taken";

export interface NewPlaceErrors {
  readonly name?: NewPlaceNameError;
  readonly radius?: "outOfRange";
}

/** The step of the slider (the prototype's); the number field takes any whole number. */
export const RADIUS_STEP_M = 50;

const WHOLE_NUMBER = /^\d+$/;

/** How two names are compared: the spaces around do not count, nor the case, as on the server. */
const nameKeyOf = (name: string): string => name.trim().toLowerCase();

/**
 * The names the screen knows are taken: the active places, every place of every axis (inactive
 * ones included) and the places added to this axis. An inactive place in no axis is unknown here:
 * the server refuses it at the save.
 */
export function knownPlaceNames(
  places: readonly AdminDeliveryPlace[],
  axes: readonly AdminDeliveryAxis[],
  values: AxisFormValues,
): ReadonlySet<string> {
  const names = [
    ...places.map((place) => place.name),
    ...axes.flatMap((axis) => axis.places.map((place) => place.name)),
    ...values.places.map((place) => place.name),
  ];
  return new Set(names.map(nameKeyOf));
}

/** The radius typed, when it is a whole number of metres within the bounds; null otherwise. */
export function parseRadius(text: string): number | null {
  const trimmed = text.trim();
  if (!WHOLE_NUMBER.test(trimmed)) {
    return null;
  }
  const radius = Number(trimmed);
  return radius >= PLACE_RADIUS_MIN_M && radius <= PLACE_RADIUS_MAX_M ? radius : null;
}

/** The radius the slider and the circle show: the one typed, kept within the bounds. */
export function shownRadius(text: string): number {
  const trimmed = text.trim();
  if (!WHOLE_NUMBER.test(trimmed)) {
    return DEFAULT_PLACE_RADIUS_M;
  }
  return Math.min(PLACE_RADIUS_MAX_M, Math.max(PLACE_RADIUS_MIN_M, Number(trimmed)));
}

function nameErrorOf(name: string, takenNames: ReadonlySet<string>): NewPlaceNameError | null {
  const trimmed = name.trim();
  if (trimmed === "") {
    return "empty";
  }
  if (trimmed.length > DELIVERY_NAME_MAX_LENGTH) {
    return "tooLong";
  }
  return takenNames.has(nameKeyOf(trimmed)) ? "taken" : null;
}

/** What keeps a new place from joining the axis. The server checks the name again at the save. */
export function validateNewPlace(
  fields: NewPlaceFields,
  takenNames: ReadonlySet<string>,
): NewPlaceErrors {
  const name = nameErrorOf(fields.name, takenNames);
  return {
    ...(name === null ? {} : { name }),
    ...(parseRadius(fields.radiusText) === null ? { radius: "outOfRange" } : {}),
  };
}
