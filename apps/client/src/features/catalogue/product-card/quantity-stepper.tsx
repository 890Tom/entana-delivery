import type { ReactElement, Ref } from "react";

import { IconButton } from "../../../components/icon-button/icon-button";
import { texts } from "../../../i18n/texts";
import { MAX_LINE_QUANTITY } from "../../cart/cart-limits";

import styles from "./quantity-stepper.module.css";

interface QuantityStepperProps {
  readonly name: string;
  readonly quantity: number;
  readonly increaseRef: Ref<HTMLButtonElement>;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
}

/** Minus (a bin at the last unit), the quantity, plus. The quantity is announced politely. */
export function QuantityStepper({
  name,
  quantity,
  increaseRef,
  onDecrease,
  onIncrease,
}: QuantityStepperProps): ReactElement {
  const text = texts.catalogue.product;
  const isLastUnit = quantity === 1;
  return (
    <div className={styles.stepper} role="group" aria-label={text.quantityGroup(name)}>
      <IconButton
        icon={isLastUnit ? "trash" : "minus"}
        label={isLastUnit ? text.removeAria(name) : text.decreaseAria(name)}
        onClick={onDecrease}
      />
      <span className={styles.count} aria-live="polite">
        {quantity}
      </span>
      <IconButton
        ref={increaseRef}
        icon="plus"
        label={text.increaseAria(name)}
        isDisabled={quantity >= MAX_LINE_QUANTITY}
        onClick={onIncrease}
      />
    </div>
  );
}
