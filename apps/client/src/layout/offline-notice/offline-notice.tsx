import type { ReactElement } from "react";

import { Notice } from "../../components/notice/notice";
import { texts } from "../../i18n/texts";
import { useIsOnline } from "../online-status/use-online-status";

import styles from "../shell-notice/shell-notice.module.css";

/**
 * Under the sticky header, above the new version notice. The error notice would be an alert: the
 * live region around it announces it politely instead. It is always in the page, so that the
 * notice is announced when it appears. `aria-live="polite"` with `aria-atomic="true"` is what
 * `role="status"` means to a screen reader, without adding a second status to every screen.
 * No action: the screens retry by themselves when the network is back.
 */
export function OfflineNotice(): ReactElement {
  const isOnline = useIsOnline();
  return (
    <div aria-live="polite" aria-atomic="true">
      {!isOnline && (
        <div className={styles.frame}>
          <Notice tone="error" isAnnounced={false}>
            {texts.connection.offline}
          </Notice>
        </div>
      )}
    </div>
  );
}
