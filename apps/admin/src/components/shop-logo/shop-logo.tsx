import type { ReactElement } from "react";
import { useState } from "react";

import { useInstance } from "../../features/instance/hooks/use-instance";
import { texts } from "../../i18n/texts";

import styles from "./shop-logo.module.css";

interface ShopLogoProps {
  /** "auth" is the larger logo of the sign-in card, "header" the one of the page header. */
  readonly size: "auth" | "header";
}

/**
 * The logo of the shop, or its name when there is no logo or it cannot be shown. The place is
 * reserved while the instance loads, so that the page does not move when the logo arrives.
 */
export function ShopLogo({ size }: ShopLogoProps): ReactElement {
  const instance = useInstance();
  const [hasLogoFailed, setHasLogoFailed] = useState(false);
  const sizeClass = size === "auth" ? styles.auth : styles.header;
  if (instance.isPending) {
    return <span className={[styles.skeleton, sizeClass].join(" ")} aria-hidden="true" />;
  }
  const name = instance.data?.name ?? texts.login.logoFallback;
  const logoUrl = instance.data?.logoUrl ?? null;
  if (logoUrl === null || hasLogoFailed) {
    return <span className={styles.name}>{name}</span>;
  }
  return (
    <img
      className={[styles.logo, sizeClass].join(" ")}
      src={logoUrl}
      alt={name}
      onError={() => {
        setHasLogoFailed(true);
      }}
    />
  );
}
