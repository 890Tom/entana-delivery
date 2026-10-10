import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import layout from "../card-layout/card-layout.module.css";
import page from "../catalogue.module.css";

import styles from "./product-grid-skeleton.module.css";

// What fills the first screen: 2 rows of 2 columns on mobile, 2 rows of 4 on the web layout.
const MOBILE_CARD_COUNT = 4;
const WEB_CARD_COUNT = 8;

const CARD_INDEXES = Array.from({ length: WEB_CARD_COUNT }, (_unused, index) => index);

function SkeletonCard({ isWebOnly }: { isWebOnly: boolean }): ReactElement {
  return (
    <div className={isWebOnly ? page.webOnly : undefined}>
      <div className={layout.card}>
        <div className={[layout.photo, styles.block].join(" ")} />
        <div>
          <div className={[layout.line, styles.block, styles.line, styles.name].join(" ")} />
          <div className={[layout.line, styles.block, styles.line, styles.price].join(" ")} />
        </div>
        <div className={[layout.action, styles.block].join(" ")} />
      </div>
    </div>
  );
}

export function ProductGridSkeleton(): ReactElement {
  return (
    <div aria-busy="true">
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
      <div className={page.grid} aria-hidden="true">
        {CARD_INDEXES.map((index) => (
          <SkeletonCard key={index} isWebOnly={index >= MOBILE_CARD_COUNT} />
        ))}
      </div>
    </div>
  );
}
