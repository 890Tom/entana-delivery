import { useContext, useState, useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { Notice } from "../../components/notice/notice";
import { texts } from "../../i18n/texts";
import { APP_UPDATE_CONTEXT } from "./app-update-context";
import type { AppUpdate } from "./app-update-context";

import styles from "./app-update-notice.module.css";

const t = texts.appUpdate;

/**
 * The live region is always in the page, so that the notice is announced when it appears in it.
 * "Plus tard" hides it until the next load; only "Mettre à jour" reloads the page.
 */
function WaitingUpdateNotice({ update }: { update: AppUpdate }): ReactElement {
  const isWaiting = useSyncExternalStore(update.store.subscribe, update.store.isWaiting);
  const [isDismissed, setIsDismissed] = useState(false);
  return (
    <div role="status">
      {isWaiting && !isDismissed && (
        <div className={styles.frame}>
          <Notice
            tone="info"
            isAnnounced={false}
            action={{ label: t.apply, onClick: update.apply }}
            secondaryAction={{
              label: t.later,
              onClick: () => {
                setIsDismissed(true);
              },
            }}
          >
            {t.message}
          </Notice>
        </div>
      )}
    </div>
  );
}

/** Under the sticky header, in the flow of the page: it covers neither the bars nor the content. */
export function AppUpdateNotice(): ReactElement | null {
  const update = useContext(APP_UPDATE_CONTEXT);
  return update === null ? null : <WaitingUpdateNotice update={update} />;
}
