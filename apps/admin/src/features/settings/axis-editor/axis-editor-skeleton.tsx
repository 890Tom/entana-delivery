import type { ReactElement } from "react";

import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import cardStyles from "../../../components/card/card.module.css";
import positionStyles from "../../../map/position-map.module.css";

import styles from "./axis-editor.module.css";
import screenStyles from "../settings-screen.module.css";

/** The screen of an axis while the axes and the places load: same columns, same sizes. */
export function AxisEditorSkeleton(): ReactElement {
  return (
    <div className={styles.screen} aria-busy="true">
      <div className={styles.columns} aria-hidden="true">
        <div className={[cardStyles.card, styles.card].join(" ")}>
          <span className={[screenStyles.block, screenStyles.blockLabel].join(" ")} />
          <span className={[screenStyles.block, screenStyles.blockField].join(" ")} />
          <span className={[screenStyles.block, screenStyles.blockLabel].join(" ")} />
          <span className={[screenStyles.block, screenStyles.blockField].join(" ")} />
          <span className={[screenStyles.block, screenStyles.blockButton].join(" ")} />
        </div>
        <div className={cardStyles.card}>
          <div className={positionStyles.frame}>
            <div className={positionStyles.skeleton} />
          </div>
        </div>
      </div>
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
    </div>
  );
}
