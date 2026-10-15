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
import type { AdminProduct } from "@entana/contracts";
import { useId } from "react";
import type { ReactElement } from "react";

import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";

import { DragHandle } from "../../../components/drag-handle/drag-handle";
import { ProductRowView } from "./product-row";
import type { RowActions } from "./product-row";
import styles from "./product-table.module.css";

const t = texts.catalogue;

interface ProductTableProps {
  readonly products: readonly AdminProduct[];
  readonly now: Date;
  readonly canReorder: boolean;
  readonly actionsOf: (product: AdminProduct) => RowActions;
  readonly onMove: (ids: readonly string[]) => void;
  /** The element that describes the drag, for assistive technology. */
  readonly helpId: string;
}

function SortableRow({
  product,
  position,
  total,
  now,
  actions,
}: {
  product: AdminProduct;
  position: number;
  total: number;
  now: Date;
  actions: RowActions;
}): ReactElement {
  const sortable = useSortable({ id: product.id });
  // Only vertical, and no stretch: a row follows the pointer along the list, nothing else.
  const transform =
    sortable.transform === null ? null : { ...sortable.transform, x: 0, scaleX: 1, scaleY: 1 };
  return (
    <ProductRowView
      product={product}
      now={now}
      actions={actions}
      rowRef={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: sortable.transition }}
      isDragging={sortable.isDragging}
      handle={
        <DragHandle
          label={t.row.handle(product.name, position, total)}
          drag={{
            attributes: { ...sortable.attributes, "aria-roledescription": "ligne déplaçable" },
            listeners: sortable.listeners,
            activatorRef: sortable.setActivatorNodeRef,
          }}
        />
      }
    />
  );
}

function announcementsFor(products: readonly AdminProduct[]): Announcements {
  const describe = (id: string | number): { name: string; position: number } => {
    const index = products.findIndex((product) => product.id === id);
    return { name: products[index]?.name ?? "", position: index + 1 };
  };
  const total = products.length;
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

function SortableRows(props: ProductTableProps): ReactElement {
  return (
    <tbody>
      {props.products.map((product, index) => (
        <SortableRow
          key={product.id}
          product={product}
          position={index + 1}
          total={props.products.length}
          now={props.now}
          actions={props.actionsOf(product)}
        />
      ))}
    </tbody>
  );
}

function StaticRows({ products, now, actionsOf }: ProductTableProps): ReactElement {
  return (
    <tbody>
      {products.map((product, index) => (
        <ProductRowView
          key={product.id}
          product={product}
          now={now}
          actions={actionsOf(product)}
          handle={<DragHandle label={t.row.handle(product.name, index + 1, products.length)} />}
        />
      ))}
    </tbody>
  );
}

function TableFrame({
  helpId,
  children,
}: {
  helpId: string;
  children: ReactElement;
}): ReactElement {
  return (
    <div className={styles.frame}>
      <table className={styles.table} aria-label={t.tableLabel} aria-describedby={helpId}>
        <thead className={styles.head}>
          <tr>
            <th scope="col">
              <span className={visuallyHidden.visuallyHidden}>{t.columns.handle}</span>
            </th>
            <th scope="col">
              <span className={visuallyHidden.visuallyHidden}>{t.columns.photo}</span>
            </th>
            <th scope="col">{t.columns.product}</th>
            <th scope="col" className={styles.numeric}>
              {t.columns.price}
            </th>
            <th scope="col">{t.columns.availability}</th>
            <th scope="col">
              <span className={visuallyHidden.visuallyHidden}>{t.columns.actions}</span>
            </th>
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

/** The drag context wraps the table, not the rows: it renders a hidden div that a table refuses. */
function SortableTable(props: ProductTableProps): ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const contextId = useId();
  const ids = props.products.map((product) => product.id);
  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      accessibility={{
        announcements: announcementsFor(props.products),
        screenReaderInstructions: { draggable: t.drag.instructions },
      }}
      onDragEnd={dropHandler(ids, props.onMove)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <TableFrame helpId={props.helpId}>
          <SortableRows {...props} />
        </TableFrame>
      </SortableContext>
    </DndContext>
  );
}

/** The rows. Dragging exists only while the list is the whole active catalogue. */
export function ProductTable(props: ProductTableProps): ReactElement {
  if (props.canReorder) {
    return <SortableTable {...props} />;
  }
  return (
    <TableFrame helpId={props.helpId}>
      <StaticRows {...props} />
    </TableFrame>
  );
}
