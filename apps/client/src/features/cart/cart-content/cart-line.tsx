import { formatAmount } from "@entana/contracts";
import { createElement } from "react";
import type { ReactElement, Ref } from "react";

import { QuantityStepper } from "../../catalogue/product-card/quantity-stepper";

import styles from "./cart-line.module.css";
import { CartThumbnail } from "./cart-thumbnail";

export interface CartDisplayLine {
  readonly productId: string;
  readonly name: string;
  readonly unitPriceAr: number;
  readonly quantity: number;
  readonly imageUrl: string | null;
}

interface CartLineProps {
  readonly line: CartDisplayLine;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
  readonly itemRef: Ref<HTMLLIElement>;
  /** The name is a heading: one level under the title of the area the line is in. */
  readonly headingLevel: "h2" | "h3";
  readonly isCountAnnounced: boolean;
}

/** The name and the prices come from the loaded catalogue; the cart only holds the quantity. */
export function CartLine({
  line,
  onDecrease,
  onIncrease,
  itemRef,
  headingLevel,
  isCountAnnounced,
}: CartLineProps): ReactElement {
  return (
    <li ref={itemRef} className={styles.line}>
      <CartThumbnail url={line.imageUrl} />
      <div>
        {createElement(headingLevel, { className: styles.name }, line.name)}
        <p className={styles.lineTotal}>{formatAmount(line.unitPriceAr * line.quantity)}</p>
      </div>
      <div className={styles.stepper}>
        <QuantityStepper
          name={line.name}
          quantity={line.quantity}
          increaseRef={null}
          onDecrease={onDecrease}
          onIncrease={onIncrease}
          isCountAnnounced={isCountAnnounced}
        />
      </div>
    </li>
  );
}
