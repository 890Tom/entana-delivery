import type { ReactElement } from "react";
import { useRef, useState } from "react";
import { Link, useRoute } from "wouter";

import { Icon } from "../../components/icon/icon";
import iconButton from "../../components/icon-button/icon-button.module.css";
import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
import { ResellersLink } from "../../features/resellers/entry/resellers-link";
import { useInstance } from "../../features/instance/api/use-instance";
import { texts } from "../../i18n/texts";
import {
  CART_PATH,
  CATALOGUE_PATH,
  CONTACT_PATH,
  DELIVERY_PATH,
  FIND_ORDER_PATH,
  RESELLERS_PATH,
  REVIEW_PATH,
  TRACKING_PATH,
} from "../../routes";

import { useReportedHeight } from "../reported-height/use-reported-height";

import { CartBadge } from "./cart-badge";
import { FindOrderLink } from "./find-order-link";
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
 * The screens of the order after the cart: a phone has a back link and the title of the step. The
 * tracking has no way back (the order is done) and only its title.
 */
function useStepHeader(): { href: string | null; label: string; title: string } | null {
  const [isDeliveryScreen] = useRoute(DELIVERY_PATH);
  const [isContactScreen] = useRoute(CONTACT_PATH);
  const [isReviewScreen] = useRoute(REVIEW_PATH);
  const [isTrackingScreen] = useRoute(TRACKING_PATH);
  const [isResellersScreen] = useRoute(RESELLERS_PATH);
  if (isResellersScreen) {
    return { href: CATALOGUE_PATH, label: texts.shell.back, title: texts.resellers.title };
  }
  if (isTrackingScreen) {
    return { href: null, label: "", title: texts.tracking.title };
  }
  if (isDeliveryScreen) {
    return { href: CART_PATH, label: texts.shell.backToCart, title: texts.shell.steps.address };
  }
  if (isContactScreen) {
    return {
      href: DELIVERY_PATH,
      label: texts.shell.backToAddress,
      title: texts.shell.steps.contact,
    };
  }
  if (isReviewScreen) {
    return {
      href: CONTACT_PATH,
      label: texts.shell.backToContact,
      title: texts.review.title,
    };
  }
  return null;
}

/**
 * The cart screen has a back link and its title, and no cart link (it is the cart). The delivery,
 * contact and review screens have the same on a phone, and the cart link beside the logo on the web
 * layout. The title is plain text: the page's one heading is the one in its content.
 */
export function Header(): ReactElement {
  const [isCartScreen] = useRoute(CART_PATH);
  // The lookup is outside the order: the logo alone, at every width.
  const [isFindOrderScreen] = useRoute(FIND_ORDER_PATH);
  const step = useStepHeader();
  const headerRef = useRef<HTMLElement>(null);
  // The side columns that stick under the header follow its real height.
  useReportedHeight(headerRef, "--size-header-height");
  return (
    <header ref={headerRef} className={styles.header}>
      <div className={styles.inner}>
        {isCartScreen && <BackLink href="/" label={texts.shell.back} />}
        {step?.href != null && (
          <BackLink href={step.href} label={step.label} className={styles.phoneOnly} />
        )}
        <HeaderBrand />
        {isCartScreen && <span className={styles.title}>{texts.cart.screen.title}</span>}
        {step !== null && (
          <span className={[styles.title, styles.phoneOnly].join(" ")}>{step.title}</span>
        )}
        {!isFindOrderScreen && (!isCartScreen || step !== null) && (
          <div className={[styles.actions, step !== null ? styles.webOnly : ""].join(" ")}>
            <div className={styles.webLink}>
              <ResellersLink />
            </div>
            <div className={styles.slot}>
              <FindOrderLink />
            </div>
            <div className={styles.slot}>
              <CartBadge />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
