import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { Announcements, DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AdminDeliveryAxis } from "@entana/contracts";
import { useId } from "react";
import type { ReactElement } from "react";
import { Link } from "wouter";

import { Pill } from "../../../components/pill/pill";
import { texts } from "../../../i18n/texts";
import { settingsAxisPath } from "../../../routes";
import { DragHandle } from "../../../components/drag-handle/drag-handle";
import { summarizeRoute } from "../rules/route-summary";

import styles from "./axes-card.module.css";

const t = texts.settings.axes;

interface AxisListProps {
  /** In priority order: the first one applies where axes overlap. */
  readonly axes: readonly AdminDeliveryAxis[];
  readonly onMove: (ids: readonly string[]) => void;
  /** The element that says how the order works, for assistive technology. */
  readonly helpId: string;
}

/** The dot, the name, the route and the number of places of an axis. */
function AxisSummary({ axis }: { axis: AdminDeliveryAxis }): ReactElement {
  return (
    <>
      {/* The colour follows the axis, never its place in the list; the name always goes with it. */}
      <span className={styles.dot} style={{ backgroundColor: axis.color }} aria-hidden="true" />
      <span className={styles.text}>
        <span className={styles.name}>
          <Link
            href={settingsAxisPath(axis.id)}
            className={styles.link}
            aria-label={t.edit(axis.name)}
          >
            {axis.name}
          </Link>
          {!axis.active && <Pill tone="neutral">{t.inactive}</Pill>}
        </span>
        <span className={styles.route}>
          {summarizeRoute(axis.places.map((place) => place.name))}
        </span>
      </span>
      <span className={styles.count}>{t.placeCount(axis.places.length)}</span>
    </>
  );
}

function AxisRow({
  axis,
  position,
  total,
}: {
  axis: AdminDeliveryAxis;
  position: number;
  total: number;
}): ReactElement {
  const sortable = useSortable({ id: axis.id });
  // Only vertical, and no stretch: a row follows the pointer along the list, nothing else.
  const transform =
    sortable.transform === null ? null : { ...sortable.transform, x: 0, scaleX: 1, scaleY: 1 };
  const className = [
    styles.row,
    axis.active ? "" : styles.inactive,
    sortable.isDragging ? styles.dragging : "",
  ].join(" ");
  return (
    <li
      ref={sortable.setNodeRef}
      className={className}
      style={{ transform: CSS.Transform.toString(transform), transition: sortable.transition }}
    >
      <DragHandle
        label={t.handle(axis.name, position, total)}
        drag={{
          attributes: { ...sortable.attributes, "aria-roledescription": "ligne déplaçable" },
          listeners: sortable.listeners,
          activatorRef: sortable.setActivatorNodeRef,
        }}
      />
      <AxisSummary axis={axis} />
    </li>
  );
}

function announcementsFor(axes: readonly AdminDeliveryAxis[]): Announcements {
  const describe = (id: string | number): { name: string; position: number } => {
    const index = axes.findIndex((axis) => axis.id === id);
    return { name: axes[index]?.name ?? "", position: index + 1 };
  };
  const total = axes.length;
  return {
    onDragStart: ({ active }) => {
      const { name, position } = describe(active.id);
      return t.drag.picked(name, position, total);
    },
    onDragOver: ({ active, over }) => {
      const { name } = describe(active.id);
      return over === null ? undefined : t.drag.moved(name, describe(over.id).position, total);
    },
    onDragEnd: ({ active, over }) => {
      const { name } = describe(active.id);
      return over === null ? undefined : t.drag.dropped(name, describe(over.id).position, total);
    },
    onDragCancel: () => t.drag.cancelled,
  };
}

/** A drop on another row is a move of the whole list; a drop in place is nothing. */
function dropHandler(
  ids: readonly string[],
  onMove: (ids: readonly string[]) => void,
): (event: DragEndEvent) => void {
  return ({ active, over }) => {
    if (over !== null && active.id !== over.id) {
      onMove(arrayMove([...ids], ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
    }
  };
}

/** The axes in priority order, moved with the pointer or with the keyboard on their handle. */
export function AxisList({ axes, onMove, helpId }: AxisListProps): ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const contextId = useId();
  const ids = axes.map((axis) => axis.id);
  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      accessibility={{
        announcements: announcementsFor(axes),
        screenReaderInstructions: { draggable: t.drag.instructions },
      }}
      onDragEnd={dropHandler(ids, onMove)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className={styles.list} aria-label={t.listLabel} aria-describedby={helpId}>
          {axes.map((axis, index) => (
            <AxisRow key={axis.id} axis={axis} position={index + 1} total={axes.length} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
