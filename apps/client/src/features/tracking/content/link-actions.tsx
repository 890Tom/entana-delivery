import type { ReactElement } from "react";
import { useLocation } from "wouter";

import { Button } from "../../../components/button/button";
import { texts } from "../../../i18n/texts";
import { TRACKING_PATH } from "../../../routes";
import { removeConfirmedOrder } from "../../order-submission/storage/confirmed-orders-storage";

import styles from "./link-actions.module.css";
import { useClipboardFeedback } from "./use-clipboard-feedback";

/**
 * Copy the link of the order (it gives access to it) and forget the order on this device. The
 * token is only read when a button is pressed: it is in no text and no attribute of the page.
 */
export function LinkActions({ token }: { readonly token: string }): ReactElement {
  const { link, feedback: messages } = texts.tracking;
  const feedback = useClipboardFeedback();
  const [, navigate] = useLocation();
  return (
    <div className={styles.actions}>
      <Button
        onClick={() => {
          feedback.copy(`${window.location.origin}${TRACKING_PATH}#${token}`, messages.linkCopied);
        }}
      >
        {link.copy}
      </Button>
      <p className={styles.warning}>{link.warning}</p>
      <p className={styles.feedback} aria-live="polite">
        {feedback.message}
      </p>
      <Button
        variant="ghost"
        onClick={() => {
          removeConfirmedOrder(token);
          navigate("/");
        }}
      >
        {link.forget}
      </Button>
    </div>
  );
}
