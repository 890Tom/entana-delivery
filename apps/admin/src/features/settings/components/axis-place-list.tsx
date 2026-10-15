import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { Announcements, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId } from "react";
import type { ReactElement } from "react";

import { Pill } from "../../../components/pill/pill";
import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import { DragHandle } from "../../../components/drag-handle/drag-handle";
import type { AxisFormPlace } from "../rules/axis-form";
import { badgeTextTone } from "../rules/badge-tone";

import styles from "./axis-editor.module.css";
import drawingStyles from "./place-drawing.module.css";

const t = texts.settings.axisEditor.places;

/** A place of the list, with what the screen knows about it beside the form. */
export interface PlaceRow {
  readonly place: AxisFormPlace;
  /** Not among the active places of the shop: the server keeps it only because it is in the axis. */
  readonly isInactive: boolean;
  /** The other axes that hold the place. */
  readonly alsoIn: readonly string[];
}

interface AxisPlaceListProps {
  readonly rows: readonly PlaceRow[];
  readonly color: string;
  /** From one position to another, counted from 0. */
  readonly onMove: (from: number, to: number) => void;
  readonly onRemove: (placeId: string) => void;
  /** The point being named on the map: a last row with its number to come. */
  readonly hasDraft: boolean;
}

/** The number of the place on a badge of the axis colour, as on the map. */
function RankBadge({ rank, color }: { rank: number; color: string }): ReactElement {
  return (
    <span
      className={[styles.badge, styles[badgeTextTone(color)]].join(" ")}
      // The colour is data of the axis, chosen by the shop: it cannot be a design token.
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {rank}
    </span>
  );
}

function PlaceText({ row }: { row: PlaceRow }): ReactElement {
  return (
    <span className={styles.placeText}>
      <span className={styles.placeName}>
        {row.place.name}
        {row.isInactive && <Pill tone="neutral">{t.inactive}</Pill>}
      </span>
      {row.alsoIn.length > 0 && <span className={styles.alsoIn}>{t.alsoIn(row.alsoIn)}</span>}
    </span>
  );
}

interface PlaceItemProps {
  readonly row: PlaceRow;
  readonly position: number;
  readonly total: number;
  readonly color: string;
  readonly onRemove: (placeId: string) => void;
}

function PlaceItem({ row, position, total, color, onRemove }: PlaceItemProps): ReactElement {
  const sortable = useSortable({ id: row.place.id });
  // Only vertical, and no stretch: a row follows the pointer along the list, nothing else.
  const transform =
    sortable.transform === null ? null : { ...sortable.transform, x: 0, scaleX: 1, scaleY: 1 };
  return (
    <li
      ref={sortable.setNodeRef}
      className={[styles.placeRow, sortable.isDragging ? styles.dragging : ""].join(" ")}
      style={{ transform: CSS.Transform.toString(transform), transition: sortable.transition }}
    >
      <DragHandle
        label={t.handle(row.place.name, position, total)}
        drag={{
          attributes: { ...sortable.attributes, "aria-roledescription": "ligne déplaçable" },
          listeners: sortable.listeners,
          activatorRef: sortable.setActivatorNodeRef,
        }}
      />
      <RankBadge rank={position} color={color} />
      <PlaceText row={row} />
      <button
        type="button"
        className={styles.remove}
        aria-label={t.remove(row.place.name)}
        onClick={() => {
          onRemove(row.place.id);
        }}
      >
        <OrderIcon name="x" size={20} />
      </button>
    </li>
  );
}

function announcementsFor(rows: readonly PlaceRow[]): Announcements {
  const describe = (id: string | number): { name: string; position: number } => {
    const index = rows.findIndex((row) => row.place.id === id);
    return { name: rows[index]?.place.name ?? "", position: index + 1 };
  };
  const total = rows.length;
  return {
    onDragStart: ({ active }) => {
      const { name, position } = describe(active.id);
      return t.drag.picked(name, position, total);
    },
    onDragOver: ({ active, over }) =>
      over === null
        ? undefined
        : t.drag.moved(describe(active.id).name, describe(over.id).position, total),
    onDragEnd: ({ active, over }) =>
      over === null
        ? undefined
        : t.drag.dropped(describe(active.id).name, describe(over.id).position, total),
    onDragCancel: () => t.drag.cancelled,
  };
}

/** The point being named, after the places: no handle, no removal, its number to come. */
function DraftRow({ rank }: { rank: number }): ReactElement {
  return (
    <li className={[styles.placeRow, drawingStyles.draftRow].join(" ")}>
      <span className={[styles.badge, drawingStyles.draftBadge].join(" ")} aria-hidden="true">
        {rank}
      </span>
      <span className={styles.alsoIn}>{t.draft}</span>
    </li>
  );
}

/** A drop on another row moves the place there; a drop in place is nothing. */
function dropHandler(
  ids: readonly string[],
  onMove: (from: number, to: number) => void,
): (event: DragEndEvent) => void {
  return ({ active, over }) => {
    if (over !== null && active.id !== over.id) {
      onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    }
  };
}

/** The places of the axis in the order of the route, moved with the pointer or the keyboard. */
export function AxisPlaceList(props: AxisPlaceListProps): ReactElement {
  const { rows, color, onMove, onRemove } = props;
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const contextId = useId();
  const ids = rows.map((row) => row.place.id);
  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      accessibility={{
        announcements: announcementsFor(rows),
        screenReaderInstructions: { draggable: t.drag.instructions },
      }}
      onDragEnd={dropHandler(ids, onMove)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className={styles.placeList} aria-label={t.title}>
          {rows.map((row, index) => (
            <PlaceItem
              key={row.place.id}
              row={row}
              position={index + 1}
              total={rows.length}
              color={color}
              onRemove={onRemove}
            />
          ))}
          {props.hasDraft && <DraftRow rank={rows.length + 1} />}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
