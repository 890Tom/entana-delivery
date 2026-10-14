import type { GeoPoint } from "@entana/contracts";
import { useRef, useState } from "react";

import { canAddPlace } from "../rules/axis-form";
import { parseRadius, validateNewPlace } from "../rules/new-place";
import type { NewPlaceErrors } from "../rules/new-place";
import {
  cancelDraft,
  draftAdded,
  draftOf,
  editDraft,
  IDLE_DRAWING,
  nextUndo,
  pickPoint,
  startCreating,
  startTracing,
} from "../rules/place-drawing";
import type { DraftChange, PlaceDraft, PlaceDrawing } from "../rules/place-drawing";

import type { AxisFormModel } from "./use-axis-form";

export interface PlaceDrawingModel {
  readonly mode: PlaceDrawing["mode"];
  /** The point being named: the window « Nouveau lieu » is open while it is not null. */
  readonly draft: PlaceDraft | null;
  /** Shown once « Ajouter à l'axe » was refused. */
  readonly draftErrors: NewPlaceErrors;
  /** The axis holds the most places allowed: no place can be created. */
  readonly isFull: boolean;
  readonly canUndo: boolean;
  readonly toggleCreate: () => void;
  readonly toggleTrace: () => void;
  readonly pick: (point: GeoPoint) => void;
  readonly edit: (change: DraftChange) => void;
  readonly confirm: () => void;
  /** « Annuler » of the window, and Escape: the point goes, a creation ends. */
  readonly cancel: () => void;
  readonly undo: () => void;
}

interface Dependencies {
  readonly form: Pick<AxisFormModel, "values" | "addNewPlace" | "removePlace">;
  /** The names a new place cannot take, trimmed and in lower case. */
  readonly takenNames: ReadonlySet<string>;
}

type SetDrawing = (change: (current: PlaceDrawing) => PlaceDrawing) => void;

/** Adds the draft to the axis when it is valid, else shows its errors. */
function confirmDraft(
  draft: PlaceDraft,
  { form, takenNames }: Dependencies,
  next: { readonly newId: () => string; readonly setDrawing: SetDrawing },
): void {
  const errors = validateNewPlace(draft, takenNames);
  const radiusM = parseRadius(draft.radiusText);
  if (errors.name !== undefined || radiusM === null) {
    next.setDrawing((current) => editDraft(current, { hasTried: true }));
    return;
  }
  const id = next.newId();
  form.addNewPlace({
    kind: "new",
    id,
    name: draft.name.trim(),
    latitude: draft.point.lat,
    longitude: draft.point.lng,
    radiusM,
  });
  next.setDrawing((current) => draftAdded(current, id));
}

type ModeActions = Pick<
  PlaceDrawingModel,
  "toggleCreate" | "toggleTrace" | "pick" | "edit" | "cancel"
>;

/** The changes of mode and of the draft, each made on the latest state. */
function modeActions(drawing: PlaceDrawing, setDrawing: SetDrawing, isFull: boolean): ModeActions {
  return {
    toggleCreate: () => {
      setDrawing(() => (drawing.mode === "create" ? IDLE_DRAWING : startCreating()));
    },
    toggleTrace: () => {
      setDrawing(() => (drawing.mode === "trace" ? IDLE_DRAWING : startTracing()));
    },
    pick: (point) => {
      setDrawing((current) => pickPoint(current, point, !isFull));
    },
    edit: (change) => {
      setDrawing((current) => editDraft(current, change));
    },
    cancel: () => {
      setDrawing(cancelDraft);
    },
  };
}

/**
 * The clicks on the map of the axis: « Créer un lieu » for one place, the trace for a place per
 * click. A place created here joins the form only: it is sent with the axis.
 */
export function usePlaceDrawing(dependencies: Dependencies): PlaceDrawingModel {
  const { form, takenNames } = dependencies;
  const [drawing, setDrawing] = useState<PlaceDrawing>(IDLE_DRAWING);
  const lastKey = useRef(0);
  const draft = draftOf(drawing);
  const isFull = !canAddPlace(form.values);
  const undoStep = nextUndo(drawing, new Set(form.values.places.map((place) => place.id)));
  const newId = (): string => {
    lastKey.current += 1;
    return `new-${String(lastKey.current)}`;
  };
  return {
    mode: drawing.mode,
    draft,
    draftErrors: draft?.hasTried === true ? validateNewPlace(draft, takenNames) : {},
    isFull,
    canUndo: undoStep.kind !== "none",
    ...modeActions(drawing, setDrawing, isFull),
    confirm: () => {
      if (draft !== null) {
        confirmDraft(draft, dependencies, { newId, setDrawing });
      }
    },
    undo: () => {
      if (undoStep.kind === "place") {
        form.removePlace(undoStep.placeId);
      } else {
        setDrawing(cancelDraft);
      }
    },
  };
}
