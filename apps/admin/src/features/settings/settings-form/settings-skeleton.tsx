import type { ReactElement } from "react";

import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import cardStyles from "../../../components/card/card.module.css";

import styles from "../settings-screen.module.css";

/** The card of a tab while the settings load: its title, a field and the button, same sizes. */
export function SettingsSkeleton(): ReactElement {
  return (
    <div className={styles.columns} aria-busy="true">
      <div className={[cardStyles.card, styles.card].join(" ")} aria-hidden="true">
        <span className={[styles.block, styles.blockTitle].join(" ")} />
        <span className={[styles.block, styles.blockLabel].join(" ")} />
        <span className={[styles.block, styles.blockField].join(" ")} />
        <span className={[styles.block, styles.blockButton].join(" ")} />
      </div>
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
    </div>
  );
}
