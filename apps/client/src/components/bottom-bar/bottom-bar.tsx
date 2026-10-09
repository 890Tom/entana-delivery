import type { ReactElement } from "react";
import { Link } from "wouter";

import { texts } from "../../i18n/texts";

import styles from "./bottom-bar.module.css";

/** The amount shown after the label: not yet known (loading), or the formatted text. */
export type BottomBarAmount =
  { readonly status: "loading" } | { readonly status: "ready"; readonly text: string };

interface BottomBarProps {
  readonly href: string;
  readonly label: string;
  /** Left out when there is no amount to show (a screen without one, or a failed catalogue). */
  readonly amount?: BottomBarAmount;
}

function Label({ label, amount }: Pick<BottomBarProps, "label" | "amount">): ReactElement | string {
  if (amount?.status === "ready") {
    return `${label}${texts.common.amountSeparator}${amount.text}`;
  }
  if (amount?.status === "loading") {
    // The placeholder is decoration: the link is named by its label alone until the amount is known.
    return (
      <>
        {label}
        <span aria-hidden="true">
          {texts.common.amountSeparator}
          <span className={styles.amountPlaceholder} />
        </span>
      </>
    );
  }
  return label;
}

/**
 * The bar fixed at the bottom of a mobile screen: one primary link to the next screen. It is
 * removed (not only hidden) from 1024 px, where the web layout has its side column instead.
 */
export function BottomBar({ href, label, amount }: BottomBarProps): ReactElement {
  return (
    <div className={styles.bar}>
      <Link href={href} className={styles.link}>
        <Label label={label} amount={amount} />
      </Link>
    </div>
  );
}
