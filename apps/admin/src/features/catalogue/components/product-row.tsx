import type { AdminProduct } from "@entana/contracts";
import { useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode, Ref } from "react";
import { createPortal } from "react-dom";

import { Pill } from "../../../components/pill/pill";
import { RowMenu } from "../../../components/row-menu/row-menu";
import type { RowMenuItem } from "../../../components/row-menu/row-menu";
import { Switch } from "../../../components/switch/switch";
import { texts } from "../../../i18n/texts";
import { ModalDialog } from "../../order-detail/components/modal-dialog";
import { formatAmount } from "../../orders/rules/format-order";
import { daysUnavailable } from "../rules/unavailable-since";

import { CatalogueIcon } from "./catalogue-icons";
import styles from "./product-row.module.css";

const t = texts.catalogue;

export interface RowActions {
  readonly isPending: boolean;
  readonly onToggle: () => void;
  readonly onRetire: () => Promise<void>;
  readonly onRestore: () => Promise<void>;
}

export interface ProductRowViewProps {
  readonly product: AdminProduct;
  readonly now: Date;
  readonly actions: RowActions;
  /** The handle cell: the sortable row gives a live one, the others a disabled one. */
  readonly handle: ReactNode;
  readonly rowRef?: Ref<HTMLTableRowElement>;
  readonly style?: CSSProperties;
  readonly isDragging?: boolean;
}

function AvailabilityCell({
  product,
  now,
  actions,
}: Pick<ProductRowViewProps, "product" | "now" | "actions">): ReactElement {
  if (product.retired) {
    return <Pill tone="neutral">{t.row.retired}</Pill>;
  }
  return (
    <div className={styles.availability}>
      <Switch
        label={t.row.switchLabel(product.name)}
        isOn={product.available}
        isDisabled={actions.isPending}
        onToggle={actions.onToggle}
      />
      {product.available ? (
        <span>{t.row.available}</span>
      ) : (
        <Pill tone="highlight" icon={<CatalogueIcon name="pause-circle" size={18} />}>
          {t.row.unavailableSince(daysUnavailable(product.availabilityChangedAt, now))}
        </Pill>
      )}
    </div>
  );
}

function RetireDialog({
  product,
  isBusy,
  onCancel,
  onConfirm,
}: {
  product: AdminProduct;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  // In the body: a dialog inside a table row would be invalid markup, and a transformed row
  // (while it is dragged) would become the reference of its fixed position.
  return createPortal(
    <ModalDialog
      title={t.dialog.title(product.name)}
      cancelLabel={t.dialog.cancel}
      confirmLabel={t.dialog.confirm}
      isBusy={isBusy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p>{t.dialog.body}</p>
    </ModalDialog>,
    document.body,
  );
}

function menuItemsFor(
  product: AdminProduct,
  actions: RowActions,
  onAskRetire: () => void,
): readonly RowMenuItem[] {
  if (product.retired) {
    return [
      {
        key: "restore",
        label: t.row.restore,
        tone: "normal",
        onSelect: () => void actions.onRestore(),
      },
    ];
  }
  return [{ key: "retire", label: t.row.retire, tone: "danger", onSelect: onAskRetire }];
}

function RowActionsCell({
  product,
  actions,
}: Pick<ProductRowViewProps, "product" | "actions">): ReactElement {
  const [isConfirming, setIsConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const items = menuItemsFor(product, actions, () => {
    setIsConfirming(true);
  });
  return (
    <>
      <RowMenu
        label={t.row.menu(product.name)}
        icon={<CatalogueIcon name="ellipsis" size={24} />}
        items={items}
        triggerRef={triggerRef}
      />
      {isConfirming && (
        <RetireDialog
          product={product}
          isBusy={actions.isPending}
          onCancel={() => {
            setIsConfirming(false);
            triggerRef.current?.focus();
          }}
          onConfirm={() => {
            // The row leaves the list on success, so the focus has nowhere to come back to.
            void actions.onRetire().then(() => {
              setIsConfirming(false);
            });
          }}
        />
      )}
    </>
  );
}

/** One row of the table. A product that is unavailable or retired is dimmed and tinted. */
export function ProductRowView({
  product,
  now,
  actions,
  handle,
  rowRef,
  style,
  isDragging = false,
}: ProductRowViewProps): ReactElement {
  const isDimmed = product.retired || !product.available;
  const className = [styles.row, isDimmed ? styles.dimmed : "", isDragging ? styles.dragging : ""];
  return (
    <tr ref={rowRef} style={style} className={className.join(" ")}>
      <td className={styles.handleCell}>{handle}</td>
      <td className={styles.thumbCell}>
        <span className={styles.thumb} aria-hidden="true">
          <CatalogueIcon name="image" size={24} />
        </span>
      </td>
      <td className={styles.productCell}>
        <span className={styles.name}>{product.name}</span>
        <span className={styles.sku}>{product.sku}</span>
      </td>
      <td className={styles.priceCell}>{formatAmount(product.priceAr)}</td>
      <td className={styles.availabilityCell}>
        <AvailabilityCell product={product} now={now} actions={actions} />
      </td>
      <td className={styles.menuCell}>
        <RowActionsCell product={product} actions={actions} />
      </td>
    </tr>
  );
}
