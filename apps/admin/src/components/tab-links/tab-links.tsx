import type { ReactElement } from "react";
import { Link, useLocation } from "wouter";

import styles from "./tab-links.module.css";

interface TabLink {
  readonly href: string;
  readonly label: string;
}

interface TabLinksProps {
  readonly label: string;
  readonly links: readonly TabLink[];
}

/**
 * Tabs that are addresses: each one has its own link, so they are a navigation with the current
 * page marked, not an ARIA tab list.
 */
export function TabLinks({ label, links }: TabLinksProps): ReactElement {
  const [location] = useLocation();
  return (
    <nav aria-label={label} className={styles.tabs}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={styles.tab}
          aria-current={link.href === location ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
