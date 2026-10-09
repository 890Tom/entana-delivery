import type { ReactElement } from "react";
import { Link } from "wouter";

import { Icon } from "../../components/icon/icon";
import { useCart } from "../../features/cart/cart-context";
import { texts } from "../../i18n/texts";
import { CART_PATH } from "../../routes";

import styles from "./cart-badge.module.css";

/**
 * The bag with the number of articles: the link to the cart screen, at every width for now. The
 * count is hidden from assistive technology because the name already says it.
 */
export function CartBadge(): ReactElement {
  const { itemCount } = useCart();
  return (
    <Link href={CART_PATH} className={styles.badge} aria-label={texts.cart.badgeLabel(itemCount)}>
      <Icon name="bag" />
      {itemCount > 0 && (
        <span className={styles.count} aria-hidden="true">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
