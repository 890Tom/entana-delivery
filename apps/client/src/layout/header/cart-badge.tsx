import type { ReactElement } from "react";

import { Icon } from "../../components/icon/icon";
import { useCart } from "../../features/cart/cart-context";
import { texts } from "../../i18n/texts";

import styles from "./cart-badge.module.css";

/**
 * The bag with the number of articles. Not interactive yet (no hover, no focus): it becomes the
 * link to the cart screen with that screen. The count is hidden from assistive technology
 * because the name already says it.
 */
export function CartBadge(): ReactElement {
  const { itemCount } = useCart();
  return (
    <span className={styles.badge} role="img" aria-label={texts.cart.badgeLabel(itemCount)}>
      <Icon name="bag" />
      {itemCount > 0 && (
        <span className={styles.count} aria-hidden="true">
          {itemCount}
        </span>
      )}
    </span>
  );
}
