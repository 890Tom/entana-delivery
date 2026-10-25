import type { AdminDeliveryAxis, AdminDeliveryPlace } from "@entana/contracts";
import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Link, useParams } from "wouter";

import { Notice } from "../../components/notice/notice";
import { texts } from "../../i18n/texts";
import { NotFound } from "../../layout/not-found/not-found";
import { OrderIcon } from "../../order-display/order-icons";
import { SETTINGS_PATH } from "../../routes";
import cardStyles from "../../components/card/card.module.css";
import { useAxes } from "./api/use-axes";
import { useAxisDelete } from "./axis-editor/use-axis-delete";
import type { AxisDeleteModel, AxisDeleteNotice } from "./axis-editor/use-axis-delete";
import { useAxisForm } from "./axis-editor/use-axis-form";
import type { AxisFormModel, AxisFormNotice } from "./axis-editor/use-axis-form";
import { usePlaceDrawing } from "./place-drawing/use-place-drawing";
import type { PlaceDrawingModel } from "./place-drawing/use-place-drawing";
import { usePlaces } from "./api/use-places";
import { toAxisDrawing } from "./rules/axis-editor-drawing";
import { formValuesOfAxis, newAxisForm, otherAxesOf } from "./rules/axis-form";
import { defaultAxisColor } from "./rules/axis-palette";
import { knownPlaceNames, shownRadius } from "./rules/new-place";
import type { PlaceDrawing } from "./rules/place-drawing";

import { AxisDeleteDialog } from "./axis-editor/axis-delete-dialog";
import { AxisEditorMap } from "./axis-editor/axis-editor-map";
import { AxisEditorSkeleton } from "./axis-editor/axis-editor-skeleton";
import styles from "./axis-editor/axis-editor.module.css";
import { AxisForm } from "./axis-editor/axis-form";
import type { PlaceRow } from "./axis-editor/axis-place-list";
import { MapTools } from "./place-drawing/drawing-tools";
import { NewPlaceDialog } from "./place-drawing/new-place-dialog";

const t = texts.settings.axisEditor;

const NOTICE_TEXT: Readonly<Record<AxisFormNotice | AxisDeleteNotice, string>> = {
  placeUnavailable: t.notices.placeUnavailable,
  invalid: texts.settings.notices.invalid,
  rateLimited: texts.settings.notices.rateLimited,
  failed: texts.settings.notices.failed,
  inUse: t.notices.inUse,
  deleteFailed: t.notices.deleteFailed,
};

interface Loaded {
  readonly axes: readonly AdminDeliveryAxis[];
  readonly places: readonly AdminDeliveryPlace[];
  readonly reloadAxes: () => void;
  readonly reloadPlaces: () => void;
}

function Header({ title }: { title: string }): ReactElement {
  return (
    <header className={styles.header}>
      <Link href={SETTINGS_PATH} className={styles.back}>
        <OrderIcon name="arrow-left" size={20} />
        {t.back}
      </Link>
      <h1 className={styles.heading}>{title}</h1>
    </header>
  );
}

/** The rows of the list: an inactive place is one the shop no longer offers. */
function useRows(model: AxisFormModel, loaded: Loaded, axisId: string | null): PlaceRow[] {
  const activeIds = useMemo(() => new Set(loaded.places.map((place) => place.id)), [loaded.places]);
  return model.values.places.map((place) => ({
    place,
    isInactive: place.kind === "existing" && !activeIds.has(place.id),
    alsoIn: otherAxesOf(loaded.axes, place.id, axisId),
  }));
}

const LEGEND: Readonly<Record<PlaceDrawing["mode"], string>> = {
  idle: t.map.legend,
  create: t.map.createLegend,
  trace: t.map.traceLegend,
};

interface MapCardProps {
  readonly model: AxisFormModel;
  readonly loaded: Loaded;
  readonly drawing: PlaceDrawingModel;
}

function MapCard({ model, loaded, drawing }: MapCardProps): ReactElement {
  const { draft } = drawing;
  const axisDrawing = useMemo(() => {
    const pending =
      draft === null ? null : { ...draft.point, radiusM: shownRadius(draft.radiusText) };
    return toAxisDrawing(model.values, loaded.places, pending);
  }, [model.values, loaded.places, draft]);
  return (
    <section
      className={cardStyles.card}
      aria-label={t.map.title}
      onKeyDown={(event) => {
        // Escape closes the window « Nouveau lieu » and leaves « Créer un lieu ».
        if (event.key === "Escape") {
          drawing.cancel();
        }
      }}
    >
      <AxisEditorMap
        drawing={axisDrawing}
        onPick={drawing.pick}
        isAddressSearchShown={drawing.mode !== "idle"}
      >
        <MapTools drawing={drawing} />
        {draft !== null && (
          <NewPlaceDialog
            draft={draft}
            errors={drawing.draftErrors}
            onEdit={drawing.edit}
            onConfirm={drawing.confirm}
            onCancel={drawing.cancel}
          />
        )}
      </AxisEditorMap>
      <p className={cardStyles.muted}>{LEGEND[drawing.mode]}</p>
    </section>
  );
}

interface EditorPageProps {
  /** The axis being changed; null for a new one. */
  readonly axis: AdminDeliveryAxis | null;
  readonly loaded: Loaded;
}

/** The question of the deletion, on an axis that exists, once it is asked. */
function DeleteQuestion({
  axis,
  deletion,
}: {
  axis: AdminDeliveryAxis | null;
  deletion: AxisDeleteModel;
}): ReactElement | null {
  if (axis === null || !deletion.isAsking) {
    return null;
  }
  return (
    <AxisDeleteDialog
      name={axis.name}
      isBusy={deletion.isBusy}
      onCancel={deletion.cancel}
      onConfirm={deletion.confirm}
    />
  );
}

function EditorPage({ axis, loaded }: EditorPageProps): ReactElement {
  const axisId = axis?.id ?? null;
  const [initial] = useState(() =>
    axis === null ? newAxisForm(defaultAxisColor(loaded.axes)) : formValuesOfAxis(axis),
  );
  const model = useAxisForm(initial, { axisId, ...loaded });
  const takenNames = useMemo(
    () => knownPlaceNames(loaded.places, loaded.axes, model.values),
    [loaded.places, loaded.axes, model.values],
  );
  const drawing = usePlaceDrawing({ form: model, takenNames });
  const rows = useRows(model, loaded, axisId);
  const deletion = useAxisDelete(axisId, loaded.reloadAxes);
  const notice = deletion.notice ?? model.notice;
  return (
    <div className={styles.screen}>
      <Header title={axis?.name ?? t.newTitle} />
      {notice !== null && <Notice tone="error">{NOTICE_TEXT[notice]}</Notice>}
      <div className={styles.columns}>
        <AxisForm
          model={model}
          rows={rows}
          places={loaded.places}
          onAskDelete={axisId === null ? null : deletion.ask}
          drawing={drawing}
        />
        <MapCard model={model} loaded={loaded} drawing={drawing} />
      </div>
      <DeleteQuestion axis={axis} deletion={deletion} />
    </div>
  );
}

/** Waits for the axes and the places; `render` gets them once both are read. */
function WithData({ render }: { render: (loaded: Loaded) => ReactElement }): ReactElement {
  const axes = useAxes();
  const places = usePlaces();
  if (axes.axes !== undefined && places.places !== undefined) {
    return render({
      axes: axes.axes,
      places: places.places,
      reloadAxes: axes.reload,
      reloadPlaces: places.reload,
    });
  }
  if (axes.hasFailed || places.hasFailed) {
    const retry = (): void => {
      axes.reload();
      places.reload();
    };
    return (
      <Notice tone="error" action={{ label: texts.common.retry, onClick: retry }}>
        {t.loadFailed}
      </Notice>
    );
  }
  return <AxisEditorSkeleton />;
}

/** The screen of a new axis. */
export function NewAxisScreen(): ReactElement {
  return <WithData render={(loaded) => <EditorPage axis={null} loaded={loaded} />} />;
}

/** The screen of one axis, read in the list: there is no route that reads a single one. */
export function EditAxisScreen(): ReactElement {
  const { id } = useParams<{ id: string }>();
  return (
    <WithData
      render={(loaded) => {
        const axis = loaded.axes.find((candidate) => candidate.id === id);
        return axis === undefined ? (
          <NotFound />
        ) : (
          <EditorPage key={axis.id} axis={axis} loaded={loaded} />
        );
      }}
    />
  );
}
