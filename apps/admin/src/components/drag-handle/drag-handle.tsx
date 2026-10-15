import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { ReactElement, Ref } from "react";

import { CatalogueIcon } from "../catalogue-icons/catalogue-icons";
import styles from "./drag-handle.module.css";

interface DragHandleProps {
  readonly label: string;
  /** Present when the order can be changed: what dnd-kit needs to drive the handle. */
  readonly drag?: {
    readonly attributes: DraggableAttributes;
    readonly listeners: DraggableSyntheticListeners;
    readonly activatorRef: Ref<HTMLButtonElement>;
  };
}

/**
 * The handle of a row. Without `drag` it stays visible and focusable but does nothing
 * (`aria-disabled`): a drag in a filtered list would mean nothing.
 */
export function DragHandle({ label, drag }: DragHandleProps): ReactElement {
  if (drag === undefined) {
    return (
      <button type="button" className={styles.handle} aria-label={label} aria-disabled={true}>
        <CatalogueIcon name="grip" size={24} />
      </button>
    );
  }
  return (
    <button
      {...drag.attributes}
      {...drag.listeners}
      ref={drag.activatorRef}
      type="button"
      className={styles.handle}
      aria-label={label}
    >
      <CatalogueIcon name="grip" size={24} />
    </button>
  );
}
