import { useRef } from "react";
import type { ReactElement } from "react";
import { Link } from "wouter";

import { texts } from "../../i18n/texts";
import { useReportedHeight } from "../../layout/use-reported-height";

import styles from "./bottom-bar.module.css";

/** The amount shown after the label: not yet known (loading), or the formatted text. */
export type BottomBarAmount =
  { readonly status: "loading" } | { readonly status: "ready"; readonly text: string };

interface BarContent {
  readonly label: string;
  /** Left out when there is no amount to show (a screen without one, or a failed catalogue). */
  readonly amount?: BottomBarAmount;
}

/**
 * A link to the next screen, or the button that submits the form of this screen. That button may
 * be inactive (`aria-disabled`: still focusable, never `disabled`) and busy.
 */
type BottomBarProps = BarContent &
  (
    | { readonly href: string }
    | { readonly formId: string; readonly isDisabled?: boolean; readonly isBusy?: boolean }
  );

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
  const barRef = useRef<HTMLDivElement>(null);
  // The space kept free at the end of the page is the bar's real height, not a fixed one.
  useReportedHeight(barRef, "--size-bottom-bar");
  return (
    <div ref={barRef} className={styles.bar}>
      {"formId" in props ? (
        <button
          type="submit"
          form={props.formId}
          className={styles.link}
          aria-disabled={props.isDisabled === true ? true : undefined}
          aria-busy={props.isBusy === true ? true : undefined}
        >
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
