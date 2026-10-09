import { formatAmount } from "@entana/contracts";
import type { ReactElement, Ref } from "react";

import { texts } from "../../../i18n/texts";
import { QuantityStepper } from "../../catalogue/product-card/quantity-stepper";

import styles from "./cart-line.module.css";

export interface CartDisplayLine {
  readonly productId: string;
  readonly name: string;
  readonly unitPriceAr: number;
  readonly quantity: number;
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
      <div>
        <h2 className={styles.name}>{line.name}</h2>
        <p className={styles.unitPrice}>
          {texts.cart.screen.unitPrice(formatAmount(line.unitPriceAr))}
        </p>
      </div>
      <p className={styles.lineTotal}>{formatAmount(line.unitPriceAr * line.quantity)}</p>
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
