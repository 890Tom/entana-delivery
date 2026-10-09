import { formatAmount } from "@entana/contracts";
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
}

/** The name and the prices come from the loaded catalogue; the cart only holds the quantity. */
export function CartLine({ line, onDecrease, onIncrease, itemRef }: CartLineProps): ReactElement {
  return (
    <li ref={itemRef} className={styles.line}>
      <CartThumbnail url={line.imageUrl} />
      <div>
        <h2 className={styles.name}>{line.name}</h2>
        <p className={styles.lineTotal}>{formatAmount(line.unitPriceAr * line.quantity)}</p>
      </div>
      <div className={styles.stepper}>
        <QuantityStepper
          name={line.name}
          quantity={line.quantity}
          increaseRef={null}
          onDecrease={onDecrease}
          onIncrease={onIncrease}
        />
      </div>
    </li>
  );
}
