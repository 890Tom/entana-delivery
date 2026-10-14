import { DEFAULT_PLACE_RADIUS_M } from "@entana/contracts";
import type { GeoPoint } from "@entana/contracts";

/** A point clicked on the map, being named in the window « Nouveau lieu ». */
export interface PlaceDraft {
  readonly point: GeoPoint;
  readonly name: string;
  readonly radiusText: string;
  /** After a refused « Ajouter à l'axe »: the errors are shown from then on. */
  readonly hasTried: boolean;
}

/**
 * How the map of the axis takes clicks: not at all, for one place (« Créer un lieu »), or for
 * a place per click until « Terminer » (the trace, which remembers its places for the undo).
 */
export type PlaceDrawing =
  | { readonly mode: "idle" }
  | { readonly mode: "create"; readonly draft: PlaceDraft | null }
  | {
      readonly mode: "trace";
      readonly draft: PlaceDraft | null;
      /** The places added during this trace, in order. */
      readonly traced: readonly string[];
    };

export type DraftChange = Partial<Pick<PlaceDraft, "name" | "radiusText" | "hasTried">>;

/** What « Annuler le dernier point » removes. */
export type UndoStep =
  | { readonly kind: "none" }
  | { readonly kind: "draft" }
  | { readonly kind: "place"; readonly placeId: string };

export const IDLE_DRAWING: PlaceDrawing = { mode: "idle" };

export const startCreating = (): PlaceDrawing => ({ mode: "create", draft: null });

export const startTracing = (): PlaceDrawing => ({ mode: "trace", draft: null, traced: [] });

export const draftOf = (drawing: PlaceDrawing): PlaceDraft | null =>
  drawing.mode === "idle" ? null : drawing.draft;

/** A click on the map: a point to name, unless no mode is on, a window is open or the axis is full. */
export function pickPoint(drawing: PlaceDrawing, point: GeoPoint, canAdd: boolean): PlaceDrawing {
  if (drawing.mode === "idle" || drawing.draft !== null || !canAdd) {
    return drawing;
  }
  const draft = { point, name: "", radiusText: String(DEFAULT_PLACE_RADIUS_M), hasTried: false };
  return { ...drawing, draft };
}

export function editDraft(drawing: PlaceDrawing, change: DraftChange): PlaceDrawing {
  if (drawing.mode === "idle" || drawing.draft === null) {
    return drawing;
  }
  return { ...drawing, draft: { ...drawing.draft, ...change } };
}

/** The window closed without adding, or Escape: the creation ends with it, the trace goes on. */
export function cancelDraft(drawing: PlaceDrawing): PlaceDrawing {
  return drawing.mode === "trace" ? { ...drawing, draft: null } : IDLE_DRAWING;
}

/** The place joined the axis: the creation ends, the trace remembers it for the undo. */
export function draftAdded(drawing: PlaceDrawing, placeId: string): PlaceDrawing {
  return drawing.mode === "trace"
    ? { mode: "trace", draft: null, traced: [...drawing.traced, placeId] }
    : IDLE_DRAWING;
}

/** The point being named first, else the last place of this trace still in the axis. */
export function nextUndo(drawing: PlaceDrawing, presentIds: ReadonlySet<string>): UndoStep {
  if (drawing.mode !== "trace") {
    return { kind: "none" };
  }
  if (drawing.draft !== null) {
    return { kind: "draft" };
  }
  const placeId = drawing.traced.findLast((id) => presentIds.has(id));
  return placeId === undefined ? { kind: "none" } : { kind: "place", placeId };
}
