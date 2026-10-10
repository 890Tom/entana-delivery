import type { ReactElement } from "react";
import { Link } from "wouter";

import { texts } from "../../i18n/texts";

import styles from "./bottom-bar.module.css";

/** The amount shown after the label: not yet known (loading), or the formatted text. */
export type BottomBarAmount =
  { readonly status: "loading" } | { readonly status: "ready"; readonly text: string };

interface BarContent {
  readonly label: string;
  /** Left out when there is no amount to show (a screen without one, or a failed catalogue). */
  readonly amount?: BottomBarAmount;
}

/** A link to the next screen, or the button that submits the form of this screen. */
type BottomBarProps = BarContent & ({ readonly href: string } | { readonly formId: string });

function Label({ label, amount }: BarContent): ReactElement | string {
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
 * The bar fixed at the bottom of a mobile screen: one primary action, a link to the next screen
 * or the submit button of the form of the screen (named by `formId`, the form being elsewhere).
 * It is not displayed from 1024 px, where the web layout has its side column instead.
 */
export function BottomBar(props: BottomBarProps): ReactElement {
  const content = <Label label={props.label} amount={props.amount} />;
  return (
    <div className={styles.bar}>
      {"formId" in props ? (
        <button type="submit" form={props.formId} className={styles.link}>
          {content}
        </button>
      ) : (
        <Link href={props.href} className={styles.link}>
          {content}
        </Link>
      )}
    </div>
  );
}
