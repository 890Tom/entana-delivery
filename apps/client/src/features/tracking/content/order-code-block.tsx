import type { ReactElement } from "react";

import { Button } from "../../../components/button/button";
import { texts } from "../../../i18n/texts";

import styles from "./order-code-block.module.css";
import { useClipboardFeedback } from "./use-clipboard-feedback";

interface OrderCodeBlockProps {
  readonly code: string;
  /** The shop's name for the shared sentence; null while it is not known, and then no sharing. */
  readonly shopName: string | null;
}

const canShare = (): boolean => typeof navigator.share === "function";

/**
 * The code is not a secret: it is what the customer keeps and shares. The code, its explanation
 * and the way to keep it are one block, so that they are read and seen together.
 */
export function OrderCodeBlock({ code, shopName }: OrderCodeBlockProps): ReactElement {
  const { code: text } = texts.tracking;
  const feedback = useClipboardFeedback();
  return (
    <section className={styles.block} aria-label={text.label}>
      <span className={styles.label}>{text.label}</span>
      <span className={styles.code}>{code}</span>
      <p className={styles.explanation}>{text.explanation}</p>
      <p className={styles.hint}>{text.screenshot}</p>
      {shopName !== null && canShare() ? (
        <Button
          onClick={() => {
            feedback.share(text.shareText(shopName, code));
          }}
        >
          {text.share}
        </Button>
      ) : (
        <Button
          onClick={() => {
            feedback.copy(code, texts.tracking.feedback.codeCopied);
          }}
        >
          {text.copy}
        </Button>
      )}
      <p className={styles.feedback} aria-live="polite">
        {feedback.message}
      </p>
    </section>
  );
}
