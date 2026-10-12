import type { ReactElement } from "react";
import { Link, useRoute } from "wouter";

import { ShopLogo } from "../../components/shop-logo/shop-logo";
import { texts } from "../../i18n/texts";
import { HOME_PATH, ORDERS_PATH } from "../../routes";

import styles from "./header.module.css";

interface HeaderProps {
  readonly isLoggingOut: boolean;
  readonly onLogout: () => void;
}

/**
 * The banner of the administration: the shop, the sections and the way out. Only the orders exist
 * so far: the other sections are added with their screens, not shown as links to nowhere.
 */
export function Header({ isLoggingOut, onLogout }: HeaderProps): ReactElement {
  const [isOnOrders] = useRoute(ORDERS_PATH);
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={HOME_PATH} className={styles.brand}>
          <ShopLogo size="header" />
        </Link>
        <nav aria-label={texts.orders.navLabel} className={styles.nav}>
          <Link
            href={ORDERS_PATH}
            className={styles.link}
            aria-current={isOnOrders ? "page" : undefined}
          >
            {texts.orders.title}
          </Link>
        </nav>
        <button
          type="button"
          className={styles.logout}
          aria-disabled={isLoggingOut ? true : undefined}
          aria-busy={isLoggingOut ? true : undefined}
          onClick={isLoggingOut ? undefined : onLogout}
        >
          {texts.home.logout}
        </button>
      </div>
    </header>
  );
}
