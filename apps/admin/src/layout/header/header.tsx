import type { ReactElement } from "react";
import { Link, useRoute } from "wouter";

import { ShopLogo } from "../../components/shop-logo/shop-logo";
import { texts } from "../../i18n/texts";
import { CATALOGUE_PATH, HOME_PATH, ORDERS_PATH } from "../../routes";

import styles from "./header.module.css";

interface HeaderProps {
  readonly isLoggingOut: boolean;
  readonly onLogout: () => void;
}

/**
 * The banner of the administration: the shop, the sections and the way out. Only the sections
 * that have a screen are listed: the others are added with their screens, not shown as links to
 * nowhere.
 */
export function Header({ isLoggingOut, onLogout }: HeaderProps): ReactElement {
  const [isOnOrders] = useRoute(ORDERS_PATH);
  // The forms of a product belong to the catalogue: its link stays the current one there.
  const [isOnCatalogue] = useRoute(`${CATALOGUE_PATH}/*?`);
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
          <Link
            href={CATALOGUE_PATH}
            className={styles.link}
            aria-current={isOnCatalogue ? "page" : undefined}
          >
            {texts.catalogue.title}
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
