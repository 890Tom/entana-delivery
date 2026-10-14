import { arrayMove } from "@dnd-kit/sortable";
import type { AdminDeliveryAxis, AdminDeliveryPlace } from "@entana/contracts";
import { useState } from "react";
import { useLocation } from "wouter";

import type { AdminFailure, AdminResult } from "../../../data-fetching/fetch-admin";
import { SETTINGS_PATH } from "../../../routes";
import { postAxis, putAxis } from "../api/axes-calls";
import { isAxisFormChanged, isAxisFormValid, toSaveAxisRequest } from "../rules/axis-form";
import type { AxisFormValues } from "../rules/axis-form";

export type AxisFormNotice = "placeUnavailable" | "invalid" | "rateLimited" | "failed";

interface Editing {
  readonly values: AxisFormValues;
  readonly setName: (name: string) => void;
  readonly setColor: (color: string) => void;
  readonly setActive: (isActive: boolean) => void;
  readonly addPlace: (place: AdminDeliveryPlace) => void;
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

interface Refusal {
  readonly isNameTaken: boolean;
  readonly notice: AxisFormNotice | null;
}

/** What a refused save shows: only the problems this screen knows, never a word of the server. */
function describeRefusal(failure: AdminFailure): Refusal {
  if (failure.problem === "axisNameTaken") {
    return { isNameTaken: true, notice: null };
  }
  if (failure.problem === "placeUnavailable") {
    return { isNameTaken: false, notice: "placeUnavailable" };
  }
  switch (failure.kind) {
    case "invalid":
      return { isNameTaken: false, notice: "invalid" };
    case "rate_limited":
      return { isNameTaken: false, notice: "rateLimited" };
    default:
      return { isNameTaken: false, notice: "failed" };
  }
}

/** The values and their changes, each made on the latest values. */
function useEditing(initial: AxisFormValues, onNameChange: () => void): Editing {
  const [values, setValues] = useState(initial);
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
      setValues((current) => ({ ...current, places: [...current.places, place] }));
    },
    removePlace: (placeId) => {
      setValues((current) => ({
        ...current,
        places: current.places.filter((place) => place.id !== placeId),
      }));
    },
    movePlaces: (from, to) => {
      setValues((current) => ({ ...current, places: arrayMove([...current.places], from, to) }));
    },
  };
}

interface Outcome extends Dependencies {
  readonly navigate: (path: string) => void;
  readonly setIsNameTaken: (isTaken: boolean) => void;
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
  outcome.setIsNameTaken(refusal.isNameTaken);
  outcome.setNotice(refusal.notice);
  if (refusal.notice === "placeUnavailable") {
    outcome.reloadPlaces();
  }
}

interface Saving {
  readonly isSaving: boolean;
  readonly hasTried: boolean;
  readonly isNameTaken: boolean;
  readonly notice: AxisFormNotice | null;
  readonly clearNameTaken: () => void;
  readonly save: (values: AxisFormValues) => void;
}

/** Sends the axis and puts what comes back on screen; a success goes back to the list. */
function useSaving(dependencies: Dependencies): Saving {
  const { axisId } = dependencies;
  const [, navigate] = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [hasTried, setHasTried] = useState(false);
  const [isNameTaken, setIsNameTaken] = useState(false);
  const [notice, setNotice] = useState<AxisFormNotice | null>(null);

  const applyResult = (result: AdminResult<AdminDeliveryAxis>): void => {
    setIsSaving(false);
    applySaveResult(result, {
      ...dependencies,
      navigate,
      setIsNameTaken,
      setNotice,
    });
  };

  return {
    isSaving,
    hasTried,
    isNameTaken,
    notice,
    clearNameTaken: () => {
      setIsNameTaken(false);
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
  const editing = useEditing(initial, saving.clearNameTaken);
  const { values } = editing;
  const isNew = dependencies.axisId === null;
  const isChanged = isAxisFormChanged(initial, values);
  const isNameEmpty = saving.hasTried && values.name.trim() === "";
  return {
    ...editing,
    isNew,
    nameError: saving.isNameTaken ? "taken" : isNameEmpty ? "empty" : null,
    hasPlacesError: saving.hasTried && values.places.length === 0,
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
