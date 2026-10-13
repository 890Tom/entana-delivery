import type { AdminProduct } from "@entana/contracts";
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import type { CSSProperties, ReactElement, ReactNode, Ref } from "react";

import { Pill } from "../../../components/pill/pill";
import { RowMenu } from "../../../components/row-menu/row-menu";
import type { RowMenuItem } from "../../../components/row-menu/row-menu";
import { Switch } from "../../../components/switch/switch";
import { texts } from "../../../i18n/texts";
import { formatAmount } from "../../../order-display/format-order";
import { catalogueProductPath } from "../../../routes";
import { daysUnavailable } from "../rules/unavailable-since";

import { CatalogueIcon } from "./catalogue-icons";
import { RetireDialog } from "./retire-dialog";
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

function menuItemsFor(
  product: AdminProduct,
  actions: RowActions,
  handlers: { onEdit: () => void; onAskRetire: () => void },
): readonly RowMenuItem[] {
  const edit: RowMenuItem = {
    key: "edit",
    label: t.row.edit,
    tone: "normal",
    onSelect: handlers.onEdit,
  };
  if (product.retired) {
    return [
      edit,
      {
        key: "restore",
        label: t.row.restore,
        tone: "normal",
        onSelect: () => void actions.onRestore(),
      },
    ];
  }
  return [
    edit,
    { key: "retire", label: t.row.retire, tone: "danger", onSelect: handlers.onAskRetire },
  ];
}

function useMenuItems(
  product: AdminProduct,
  actions: RowActions,
  onAskRetire: () => void,
): readonly RowMenuItem[] {
  const [, navigate] = useLocation();
  return menuItemsFor(product, actions, {
    onEdit: () => {
      navigate(catalogueProductPath(product.id));
    },
    onAskRetire,
  });
}

function RowActionsCell({
  product,
  actions,
}: Pick<ProductRowViewProps, "product" | "actions">): ReactElement {
  const [isConfirming, setIsConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const items = useMenuItems(product, actions, () => {
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
          {product.image === null ? (
            <CatalogueIcon name="image" size={24} />
          ) : (
            <img src={product.image.url} alt="" loading="lazy" className={styles.photo} />
          )}
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
