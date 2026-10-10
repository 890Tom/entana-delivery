import type { ReactElement } from "react";
import { useState } from "react";
import { Link, useRoute } from "wouter";

import { Icon } from "../../components/icon/icon";
import iconButton from "../../components/icon-button/icon-button.module.css";
import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
import { useInstance } from "../../features/instance/use-instance";
import { texts } from "../../i18n/texts";
import { CART_PATH, DELIVERY_PATH } from "../../routes";

import { CartBadge } from "./cart-badge";
import styles from "./header.module.css";

// The size of the logo, not a loaded state: the header keeps the same height with or without it.
function BrandSkeleton(): ReactElement {
  return (
    <div className={styles.brand} aria-busy="true">
      <span className={styles.logoSkeleton} aria-hidden="true" />
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
    </div>
  );
}

function Brand({ name, logoUrl }: { name: string; logoUrl: string | null }): ReactElement {
  const [hasLogoFailed, setHasLogoFailed] = useState(false);
  const isLogoShown = logoUrl !== null && !hasLogoFailed;
  return (
    <Link href="/" className={styles.brand} aria-label={texts.shell.homeLabel(name)}>
      {isLogoShown ? (
        <img
          className={styles.logo}
          src={logoUrl}
          alt={name}
          onError={() => {
            setHasLogoFailed(true);
          }}
        />
      ) : (
        <span className={styles.name}>{name}</span>
      )}
    </Link>
  );
}

function HeaderBrand(): ReactElement {
  const instance = useInstance();
  if (instance.isPending) {
    return <BrandSkeleton />;
  }
  if (instance.isError) {
    return <Brand name={texts.shell.genericName} logoUrl={null} />;
  }
  return <Brand name={instance.data.name} logoUrl={instance.data.logoUrl} />;
}

/** A way back by a fixed address (never one taken from an input). */
function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}): ReactElement {
  return (
    <Link href={href} className={[iconButton.button, className ?? ""].join(" ")} aria-label={label}>
      <Icon name="arrow-left" />
    </Link>
  );
}

/**
 * The cart screen has a back link and its title, and no cart link (it is the cart). The delivery
 * screen has the same on a phone, and the cart link beside the logo on the web layout. The title
 * is plain text: the page's one heading is the one in its content.
 */
export function Header(): ReactElement {
  const [isCartScreen] = useRoute(CART_PATH);
  const [isDeliveryScreen] = useRoute(DELIVERY_PATH);
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {isCartScreen && <BackLink href="/" label={texts.shell.back} />}
        {isDeliveryScreen && (
          <BackLink href={CART_PATH} label={texts.shell.backToCart} className={styles.phoneOnly} />
        )}
        <HeaderBrand />
        {isCartScreen && <span className={styles.title}>{texts.cart.screen.title}</span>}
        {isDeliveryScreen && (
          <span className={[styles.title, styles.phoneOnly].join(" ")}>
            {texts.shell.steps.address}
          </span>
        )}
        {(!isCartScreen || isDeliveryScreen) && (
          <div className={[styles.cartSlot, isDeliveryScreen ? styles.webOnly : ""].join(" ")}>
            <CartBadge />
          </div>
        )}
      </div>
    </header>
  );
}
