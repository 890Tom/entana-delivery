import { arrayMove } from "@dnd-kit/sortable";
import type { AdminDeliveryAxis, AdminDeliveryPlace } from "@entana/contracts";
import { useState } from "react";
import { useLocation } from "wouter";

import type { AdminFailure, AdminResult } from "../../../data-fetching/fetch-admin";
import { SETTINGS_PATH } from "../../../routes";
import { postAxis, putAxis } from "../api/axes-calls";
import { isAxisFormChanged, isAxisFormValid, toSaveAxisRequest } from "../rules/axis-form";
import type { AxisFormValues, NewAxisPlace } from "../rules/axis-form";

export type AxisFormNotice = "placeUnavailable" | "invalid" | "rateLimited" | "failed";

interface Editing {
  readonly values: AxisFormValues;
  readonly setName: (name: string) => void;
  readonly setColor: (color: string) => void;
  readonly setActive: (isActive: boolean) => void;
  readonly addPlace: (place: AdminDeliveryPlace) => void;
  /** A place created on the map: it is sent with the axis, not before. */
  readonly addNewPlace: (place: NewAxisPlace) => void;
  readonly removePlace: (placeId: string) => void;
  /** Moves the place at `from` to `to`, the others shifting by one. */
  readonly movePlaces: (from: number, to: number) => void;
}

export interface AxisFormModel extends Editing {
  readonly isNew: boolean;
  /** Shown under the name: after a refused attempt, or when the server says it is taken. */
  readonly nameError: "empty" | "taken" | null;
  /** After a refused attempt with no place. */
  readonly hasPlacesError: boolean;
  /** The server says a new place has a taken name; gone once the places change. */
  readonly hasNewPlaceNameError: boolean;
  readonly notice: AxisFormNotice | null;
  readonly isSaving: boolean;
  /** Greyed: a change with nothing changed, or a creation that cannot be sent yet. */
  readonly isSaveDisabled: boolean;
  readonly submit: () => void;
}

interface Dependencies {
  /** The axis being changed; null for a new one. */
  readonly axisId: string | null;
  readonly reloadAxes: () => void;
  readonly reloadPlaces: () => void;
}

/** Whose name the server says is taken: the axis's, or a new place's. */
type TakenName = "axis" | "place" | null;

interface Refusal {
  readonly taken: TakenName;
  readonly notice: AxisFormNotice | null;
}

/** What a refused save shows: only the problems this screen knows, never a word of the server. */
function describeRefusal(failure: AdminFailure): Refusal {
  if (failure.problem === "axisNameTaken") {
    return { taken: "axis", notice: null };
  }
  if (failure.problem === "placeNameTaken") {
    return { taken: "place", notice: null };
  }
  if (failure.problem === "placeUnavailable") {
    return { taken: null, notice: "placeUnavailable" };
  }
  switch (failure.kind) {
    case "invalid":
      return { taken: null, notice: "invalid" };
    case "rate_limited":
      return { taken: null, notice: "rateLimited" };
    default:
      return { taken: null, notice: "failed" };
  }
}

interface EditingEvents {
  readonly onNameChange: () => void;
  readonly onPlacesChange: () => void;
}

/** The values and their changes, each made on the latest values. */
function useEditing(initial: AxisFormValues, events: EditingEvents): Editing {
  const { onNameChange, onPlacesChange } = events;
  const [values, setValues] = useState(initial);
  const setPlaces = (
    change: (places: AxisFormValues["places"]) => AxisFormValues["places"],
  ): void => {
    onPlacesChange();
    setValues((current) => ({ ...current, places: change(current.places) }));
  };
  return {
    values,
    setName: (name) => {
      onNameChange();
      setValues((current) => ({ ...current, name }));
    },
    setColor: (color) => {
      setValues((current) => ({ ...current, color }));
    },
    setActive: (isActive) => {
      setValues((current) => ({ ...current, active: isActive }));
    },
    addPlace: (place) => {
      setPlaces((places) => [...places, { ...place, kind: "existing" }]);
    },
    addNewPlace: (place) => {
      setPlaces((places) => [...places, place]);
    },
    removePlace: (placeId) => {
      setPlaces((places) => places.filter((place) => place.id !== placeId));
    },
    movePlaces: (from, to) => {
      setPlaces((places) => arrayMove([...places], from, to));
    },
  };
}

interface Outcome extends Dependencies {
  readonly navigate: (path: string) => void;
  readonly setTaken: (taken: TakenName) => void;
  readonly setNotice: (notice: AxisFormNotice | null) => void;
}

/** What each end of a save does on screen. */
function applySaveResult(result: AdminResult<AdminDeliveryAxis>, outcome: Outcome): void {
  if (result.kind === "ok" || result.kind === "unauthorized") {
    // The list is read again: on success it shows the axis, on a refused session the sign-in.
    outcome.reloadAxes();
    if (result.kind === "ok") {
      outcome.navigate(SETTINGS_PATH);
    }
    return;
  }
  const refusal = describeRefusal(result);
  outcome.setTaken(refusal.taken);
  outcome.setNotice(refusal.notice);
  if (refusal.notice === "placeUnavailable") {
    outcome.reloadPlaces();
  }
}

interface Saving {
  readonly isSaving: boolean;
  readonly hasTried: boolean;
  readonly taken: TakenName;
  readonly notice: AxisFormNotice | null;
  /** The message on a name goes once that name, or the places, change. */
  readonly clearTaken: (which: "axis" | "place") => void;
  readonly save: (values: AxisFormValues) => void;
}

/** Sends the axis and puts what comes back on screen; a success goes back to the list. */
function useSaving(dependencies: Dependencies): Saving {
  const { axisId } = dependencies;
  const [, navigate] = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [hasTried, setHasTried] = useState(false);
  const [taken, setTaken] = useState<TakenName>(null);
  const [notice, setNotice] = useState<AxisFormNotice | null>(null);

  const applyResult = (result: AdminResult<AdminDeliveryAxis>): void => {
    setIsSaving(false);
    applySaveResult(result, {
      ...dependencies,
      navigate,
      setTaken,
      setNotice,
    });
  };

  return {
    isSaving,
    hasTried,
    taken,
    notice,
    clearTaken: (which) => {
      setTaken((current) => (current === which ? null : current));
    },
    save: (values) => {
      setHasTried(true);
      setNotice(null);
      if (!isAxisFormValid(values)) {
        return;
      }
      setIsSaving(true);
      const body = toSaveAxisRequest(values);
      void (axisId === null ? postAxis(body) : putAxis(axisId, body)).then(applyResult);
    },
  };
}

/**
 * The state of the form of an axis: the values, what keeps them from being sent, and the save.
 * The server stays the authority: it checks the name and the places again.
 */
export function useAxisForm(initial: AxisFormValues, dependencies: Dependencies): AxisFormModel {
  const saving = useSaving(dependencies);
  const editing = useEditing(initial, {
    onNameChange: () => {
      saving.clearTaken("axis");
    },
    onPlacesChange: () => {
      saving.clearTaken("place");
    },
  });
  const { values } = editing;
  const isNew = dependencies.axisId === null;
  const isChanged = isAxisFormChanged(initial, values);
  const isNameEmpty = saving.hasTried && values.name.trim() === "";
  return {
    ...editing,
    isNew,
    nameError: saving.taken === "axis" ? "taken" : isNameEmpty ? "empty" : null,
    hasPlacesError: saving.hasTried && values.places.length === 0,
    hasNewPlaceNameError: saving.taken === "place",
    notice: saving.notice,
    isSaving: saving.isSaving,
    isSaveDisabled: isNew ? !isAxisFormValid(values) : !isChanged,
    submit: () => {
      if (!saving.isSaving && (isNew || isChanged)) {
        saving.save(values);
      }
    },
  };
}
