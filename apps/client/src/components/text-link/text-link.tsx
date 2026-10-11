import type { ReactElement } from "react";
import { Link } from "wouter";

import styles from "./text-link.module.css";

/**
 * A link made of text only, at the touch size, in the bold body font. The address is a fixed one of
 * the application, never taken from an input.
 */
export function TextLink({ href, children }: { href: string; children: string }): ReactElement {
  return (
    <Link href={href} className={styles.link}>
      {children}
    </Link>
  );
}
