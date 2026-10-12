import type { ReactElement } from "react";

import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../i18n/texts";

import styles from "./auth-skeleton.module.css";

/**
 * Shown while the session is being checked: the sign-in card's own layout and sizes, so that
 * nothing moves when the real screen arrives.
 */
export function AuthSkeleton(): ReactElement {
  return (
    <main className={styles.page} aria-busy="true">
      <div className={styles.card} aria-hidden="true">
        <span className={styles.logo} />
        <span className={styles.title} />
        <span className={styles.field} />
        <span className={styles.field} />
        <span className={styles.button} />
      </div>
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
    </main>
  );
}
