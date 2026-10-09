import { computeOrderTotal, formatAmount } from "@entana/contracts";
import { useEffect, useRef } from "react";
import type { ReactElement, RefObject } from "react";
import { Link } from "wouter";

import button from "../../../components/button/button.module.css";
import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import { useCart } from "../cart-context";

import { CartLine } from "./cart-line";
import type { CartDisplayLine } from "./cart-line";
import styles from "./cart-content.module.css";

interface CartContentProps {
  readonly lines: readonly CartDisplayLine[];
}

interface RemovalFocus {
  readonly itemRefs: RefObject<Map<string, HTMLLIElement>>;
  readonly emptyActionRef: RefObject<HTMLAnchorElement | null>;
  /** Called before a removal: picks where the focus goes once the line is gone. */
  readonly planFocusAfterRemoving: (productId: string) => void;
}

/**
 * A removed line takes its button with it: the focus goes to the next line, or to the previous
 * one when the last was removed, or to the way back when the cart is now empty.
 */
function useFocusAfterRemoval(lines: readonly CartDisplayLine[]): RemovalFocus {
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const emptyActionRef = useRef<HTMLAnchorElement>(null);
  const target = useRef<string | null>(null);
  useEffect(() => {
    if (target.current === null) {
      return;
    }
    const next = itemRefs.current.get(target.current);
    (next?.querySelector("button") ?? emptyActionRef.current)?.focus();
    target.current = null;
  }, [lines]);
  return {
    itemRefs,
    emptyActionRef,
    planFocusAfterRemoving: (productId) => {
      const index = lines.findIndex((line) => line.productId === productId);
      const neighbour = lines[index + 1] ?? lines[index - 1];
      target.current = neighbour?.productId ?? "";
    },
  };
}

function EmptyCart({
  actionRef,
}: {
  actionRef: RefObject<HTMLAnchorElement | null>;
}): ReactElement {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyText}>{texts.cart.screen.empty.text}</p>
      <Link ref={actionRef} href="/" className={[button.button, styles.emptyAction].join(" ")}>
        {texts.cart.screen.empty.action}
      </Link>
    </div>
  );
}

function Subtotal({ lines }: { lines: readonly CartDisplayLine[] }): ReactElement {
  // A display only: the server recomputes the total when the order is placed.
  const total = computeOrderTotal(
    lines.map((line) => ({ unitPrice: line.unitPriceAr, quantity: line.quantity })),
    0,
  );
  return (
    <div className={styles.footer}>
      <p className={styles.subtotal}>
        <span className={styles.subtotalLabel}>{texts.cart.screen.subtotal}</span>
        <span className={styles.subtotalAmount}>{formatAmount(total)}</span>
      </p>
      <Notice tone="info">{texts.cart.screen.deliveryHint}</Notice>
    </div>
  );
}

/** The lines of the cart with their subtotal, or the empty state. Shown once prices are known. */
export function CartContent({ lines }: CartContentProps): ReactElement {
  const cart = useCart();
  const { itemRefs, emptyActionRef, planFocusAfterRemoving } = useFocusAfterRemoval(lines);
  if (lines.length === 0) {
    return <EmptyCart actionRef={emptyActionRef} />;
  }
  return (
    <>
      <ul className={styles.list}>
        {lines.map((line) => (
          <CartLine
            key={line.productId}
            line={line}
            itemRef={(element) => {
              if (element === null) {
                itemRefs.current.delete(line.productId);
              } else {
                itemRefs.current.set(line.productId, element);
              }
            }}
            onDecrease={() => {
              if (line.quantity === 1) {
                planFocusAfterRemoving(line.productId);
              }
              cart.decrease(line.productId);
            }}
            onIncrease={() => {
              cart.increase(line.productId);
            }}
          />
        ))}
      </ul>
      <Subtotal lines={lines} />
    </>
  );
}
