import { useEffect, useRef } from "react";
import type { ReactElement, RefObject } from "react";

import { Button } from "../../../components/button/button";
import { texts } from "../../../i18n/texts";
import { useCart } from "../../cart/cart-state/cart-context";

import { QuantityStepper } from "./quantity-stepper";

interface ProductCardActionProps {
  readonly productId: string;
  readonly name: string;
}

/** The control that replaces the other one is where the focus must go, or it would be lost. */
type FocusTarget = "increase" | "add";

interface FocusHandoff {
  readonly addRef: RefObject<HTMLButtonElement | null>;
  readonly increaseRef: RefObject<HTMLButtonElement | null>;
  readonly expectFocus: (target: FocusTarget | null) => void;
}

/** Moves the focus to the control that replaces the one clicked, once it is on screen. */
function useFocusHandoff(quantity: number): FocusHandoff {
  const addRef = useRef<HTMLButtonElement>(null);
  const increaseRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  useEffect(() => {
    const target = pendingFocus.current === "add" ? addRef.current : increaseRef.current;
    if (pendingFocus.current !== null) {
      target?.focus();
    }
    pendingFocus.current = null;
  }, [quantity]);
  return {
    addRef,
    increaseRef,
    expectFocus: (target) => {
      pendingFocus.current = target;
    },
  };
}

/** "Add", then the quantity selector. Only for an available product (the card checks). */
export function ProductCardAction({ productId, name }: ProductCardActionProps): ReactElement {
  const cart = useCart();
  const quantity = cart.quantityOf(productId);
  const { addRef, increaseRef, expectFocus } = useFocusHandoff(quantity);

  if (quantity === 0) {
    return (
      <Button
        ref={addRef}
        icon="plus"
        label={texts.catalogue.product.addAria(name)}
        isDisabled={cart.isFull}
        onClick={() => {
          expectFocus("increase");
          cart.increase(productId);
        }}
      >
        {texts.catalogue.product.add}
      </Button>
    );
  }
  return (
    <QuantityStepper
      name={name}
      quantity={quantity}
      increaseRef={increaseRef}
      onDecrease={() => {
        expectFocus(quantity === 1 ? "add" : null);
        cart.decrease(productId);
      }}
      onIncrease={() => {
        cart.increase(productId);
      }}
    />
  );
}
