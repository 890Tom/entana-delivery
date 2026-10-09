import type { ReactElement } from "react";
import { useState } from "react";
import { Link } from "wouter";

import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
import { useInstance } from "../../features/instance/use-instance";
import { texts } from "../../i18n/texts";

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

export function Header(): ReactElement {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <HeaderBrand />
        {/* Kept empty: the cart button comes with the cart, and the header must not move then. */}
        <div className={styles.cartSlot} />
      </div>
    </header>
  );
}
