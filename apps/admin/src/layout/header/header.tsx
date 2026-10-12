import type { ReactElement } from "react";
import { Link } from "wouter";

import { ShopLogo } from "../../components/shop-logo/shop-logo";
import { texts } from "../../i18n/texts";
import { HOME_PATH } from "../../routes";

import styles from "./header.module.css";

interface HeaderProps {
  readonly isLoggingOut: boolean;
  readonly onLogout: () => void;
}

/** The banner of the administration: the shop, and the way out. No menu yet. */
export function Header({ isLoggingOut, onLogout }: HeaderProps): ReactElement {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={HOME_PATH} className={styles.brand}>
          <ShopLogo size="header" />
        </Link>
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
